-- Post kudos are independent snapshots; importing them never changes activity review/points.
create table public.club_discussion_posts (
 post_id bigint primary key check(post_id>0),athlete_id bigint not null check(athlete_id>0),
 athlete_name text not null check(length(athlete_name)<=200),title text not null check(length(title)<=500),posted_at timestamptz,
 activity_ids bigint[] not null,kudos_count integer not null check(kudos_count between 0 and 1000000),kudos_observed_at timestamptz not null,
 division_id smallint references public.divisions(id),group_id smallint references public.small_groups(id)
);
create index discussion_posts_date on public.club_discussion_posts(posted_at desc);
alter table public.club_discussion_posts enable row level security;
revoke all on public.club_discussion_posts from public,anon,authenticated;
create or replace function public.import_extension_posts(payload jsonb,sync_secret text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare cfg private.extension_sync_config; item jsonb; ids jsonb; total integer; has_activity boolean; observed timestamptz; kudo integer;
begin
 select * into cfg from private.extension_sync_config where id=true for update;
 if not found or sync_secret is null or length(sync_secret)<32 or cfg.secret_hash<>encode(extensions.digest(sync_secret,'sha256'),'hex') then raise exception 'Invalid sync secret' using errcode='42501'; end if;
 if cfg.window_start>now()-interval '1 minute' and cfg.requests>=60 then raise exception 'Rate limit' using errcode='PT429'; end if;
 update private.extension_sync_config set requests=case when window_start<=now()-interval '1 minute' then 1 else requests+1 end,window_start=case when window_start<=now()-interval '1 minute' then now() else window_start end where id=true;
 if payload->>'club_id' is distinct from '2368312' or jsonb_typeof(payload->'posts') is distinct from 'array' or pg_column_size(payload)>512000 then raise exception 'Invalid payload'; end if;
 total=jsonb_array_length(payload->'posts'); if total<1 or total>50 then raise exception 'Invalid batch'; end if;
 for item in select value from jsonb_array_elements(payload->'posts') loop
  if coalesce(item->>'post_id','')!~'^[0-9]{1,15}$' or coalesce(item->>'athlete_id','')!~'^[0-9]{1,15}$' or length(coalesce(item->>'title',''))>500 or length(coalesce(item->>'athlete_name',''))>200 then raise exception 'Invalid report'; end if;
  ids=item->'activity_ids'; if jsonb_typeof(ids) is distinct from 'array' or jsonb_array_length(ids)>50 then raise exception 'Invalid activity links'; end if;
  -- A report is resolved only after a linked activity was successfully imported.
  select exists(select 1 from public.club_activities a where a.activity_id::text in(select jsonb_array_elements_text(ids)) and a.source->'source_posts' @> jsonb_build_array(jsonb_build_object('post_id',item->>'post_id'))) into has_activity;
  if item->>'kudos_count' is not null then
   if item->>'kudos_count' !~ '^[0-9]{1,7}$' or (item->>'kudos_count')::integer>1000000 then raise exception 'Invalid kudos count'; end if;
   kudo=(item->>'kudos_count')::integer;
   observed=(item->>'kudos_observed_at')::timestamptz;
   if observed is null or observed>now()+interval '5 minutes' then raise exception 'Invalid observation time'; end if;
   insert into public.club_discussion_posts(post_id,athlete_id,athlete_name,title,posted_at,activity_ids,kudos_count,kudos_observed_at,division_id,group_id)
   select (item->>'post_id')::bigint,(item->>'athlete_id')::bigint,coalesce(item->>'athlete_name',''),coalesce(item->>'title',''),(item->>'posted_at')::timestamptz,
    array(select value::bigint from jsonb_array_elements_text(ids) value),kudo,observed,m.division_id,m.group_id
   from (select 1) dummy left join public.members m on m.strava_athlete_id=(item->>'athlete_id')::bigint
   on conflict(post_id) do update set
    athlete_name=coalesce(nullif(excluded.athlete_name,''),public.club_discussion_posts.athlete_name),title=excluded.title,posted_at=excluded.posted_at,
    activity_ids=excluded.activity_ids,kudos_count=excluded.kudos_count,kudos_observed_at=excluded.kudos_observed_at,
    division_id=coalesce(public.club_discussion_posts.division_id,excluded.division_id),group_id=coalesce(public.club_discussion_posts.group_id,excluded.group_id)
   where excluded.kudos_observed_at>=public.club_discussion_posts.kudos_observed_at and excluded.athlete_id=public.club_discussion_posts.athlete_id;
  end if;
  if jsonb_array_length(ids)>0 and not has_activity then continue; end if;
  insert into public.club_incomplete_posts(post_id,athlete_id,athlete_name,title,posted_at,resolved)
  values((item->>'post_id')::bigint,(item->>'athlete_id')::bigint,coalesce(item->>'athlete_name',''),coalesce(item->>'title',''),(item->>'posted_at')::timestamptz,has_activity)
  on conflict(post_id) do update set athlete_id=excluded.athlete_id,athlete_name=excluded.athlete_name,title=excluded.title,posted_at=excluded.posted_at,resolved=excluded.resolved,updated_at=now();
 end loop;
 return jsonb_build_object('processed',total);
end;
$$;
revoke all on function public.import_extension_posts(jsonb,text) from public;
grant execute on function public.import_extension_posts(jsonb,text) to anon,authenticated;
create function public.get_kudos_rankings(ranking_period text default 'event') returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare result jsonb; week_start timestamp;
begin
 if auth.uid() is null then raise exception 'Sign in required' using errcode='42501'; end if;
 if ranking_period is null or ranking_period not in('event','week') then raise exception 'Invalid period'; end if;
 week_start=date_trunc('week',now() at time zone 'Asia/Ho_Chi_Minh');
 with eligible as (
  select p.* from public.club_discussion_posts p
  where p.posted_at>='2026-10-04 00:00:00+07'::timestamptz and p.posted_at<'2026-11-16 00:00:00+07'::timestamptz
   and (ranking_period='event' or ((p.posted_at at time zone 'Asia/Ho_Chi_Minh')>=week_start and (p.posted_at at time zone 'Asia/Ho_Chi_Minh')<week_start+interval '7 days'))
   and exists(select 1 from public.club_activities a where a.activity_id=any(p.activity_ids) and a.status in('pending','approved') and a.sport_type='Walk' and a.start_local>='2026-10-04' and a.start_local<'2026-11-16')
 ), people as (
  select p.athlete_id,coalesce(nullif(btrim(m.btn_name),''),nullif(btrim(m.strava_name),''),max(nullif(p.athlete_name,'')),'Thành viên Strava') name,
   m.division_id,m.group_id,case when a.gender in('male','female') then a.gender else null end gender,
   coalesce(m.auth_user_id=auth.uid(),false) is_me,sum(p.kudos_count) kudos,count(*) posts,0 steps,0 points,count(*) activities,0 days,0 lifetime_steps,0 lifetime_days
  from eligible p left join public.members m on m.strava_athlete_id=p.athlete_id left join public.profiles a on a.id=m.auth_user_id
  group by p.athlete_id,m.btn_name,m.strava_name,m.division_id,m.group_id,a.gender,m.auth_user_id
 ), group_scores as (
  select group_id,sum(kudos_count) kudos,count(*) posts from eligible group by group_id
 ), groups as (
  select g.id,'Nhóm '||g.id name,g.division_id,coalesce(s.kudos,0) kudos,coalesce(s.posts,0) posts,0 steps,0 points,0 activities,0 members,0 participants
  from public.small_groups g left join group_scores s on s.group_id=g.id
 ), division_scores as (
  select division_id,sum(kudos_count) kudos,count(*) posts from eligible group by division_id
 ), divisions as (
  select d.id,'LĐ '||d.id name,d.id division_id,coalesce(s.kudos,0) kudos,coalesce(s.posts,0) posts,0 steps,0 points,0 activities,0 members,0 participants
  from public.divisions d left join division_scores s on s.division_id=d.id
 ), featured as (
  select p.post_id,p.title,coalesce(nullif(m.btn_name,''),nullif(m.strava_name,''),nullif(p.athlete_name,''),'Thành viên Strava') name,p.kudos_count kudos
  from eligible p left join public.members m on m.strava_athlete_id=p.athlete_id where p.kudos_count>0 order by p.kudos_count desc,p.post_id desc limit 3
 )
 select jsonb_build_object(
  'individuals',coalesce((select jsonb_agg(to_jsonb(p) order by kudos desc,athlete_id) from people p),'[]'::jsonb),
  'groups',coalesce((select jsonb_agg(to_jsonb(g) order by kudos desc,id) from groups g),'[]'::jsonb),
  'divisions',coalesce((select jsonb_agg(to_jsonb(d) order by kudos desc,id) from divisions d),'[]'::jsonb),
  'featured',coalesce((select jsonb_agg(to_jsonb(f) order by kudos desc,post_id desc) from featured f),'[]'::jsonb),
  'summary',jsonb_build_object('steps',0,'points',0,'activities',(select count(*) from eligible),'participants',(select count(*) from people),
   'roster',(select count(*) from public.members where active),'with_gender',(select count(*) from people where gender is not null),
   'kudos',coalesce((select sum(kudos_count) from eligible),0),'posts_with_kudos',(select count(*) from eligible where kudos_count>0),'updated_at',(select max(kudos_observed_at) from eligible))
 ) into result;
 return result;
end;
$$;
revoke all on function public.get_kudos_rankings(text) from public,anon;
grant execute on function public.get_kudos_rankings(text) to authenticated;
