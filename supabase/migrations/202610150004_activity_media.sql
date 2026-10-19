alter table public.club_activities add column media jsonb not null default '[]'::jsonb check(jsonb_typeof(media)='array' and jsonb_array_length(media)<=10), add column media_observed_at timestamptz;
create or replace function public.import_extension_activities(payload jsonb, sync_secret text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare cfg private.extension_sync_config; item jsonb; total integer; inserted integer:=0; affected integer; observed timestamptz;
begin
 select * into cfg from private.extension_sync_config where id=true for update;
 if not found or sync_secret is null or length(sync_secret)<32 or cfg.secret_hash<>encode(extensions.digest(sync_secret,'sha256'),'hex') then
  raise exception 'Invalid sync secret' using errcode='42501';
 end if;
 if cfg.window_start>now()-interval '1 minute' and cfg.requests>=60 then raise exception 'Rate limit' using errcode='PT429'; end if;
 update private.extension_sync_config set requests=case when window_start<=now()-interval '1 minute' then 1 else requests+1 end,
 window_start=case when window_start<=now()-interval '1 minute' then now() else window_start end where id=true;
 if payload->>'club_id' is distinct from '2368312' or jsonb_typeof(payload->'activities') is distinct from 'array' or pg_column_size(payload)>512000 then raise exception 'Invalid payload'; end if;
 total:=jsonb_array_length(payload->'activities');
 if total<1 or total>50 then raise exception 'Batch must contain 1-50 activities'; end if;
 for item in select value from jsonb_array_elements(payload->'activities') loop
  if coalesce(item->>'activity_id','')!~'^[0-9]{1,15}$' or coalesce(item->>'athlete_id','')!~'^[0-9]{1,15}$'
  or coalesce(item->>'start_local','')!~'^202[0-9]-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}$'
  or length(coalesce(item->>'name',''))>500 or length(coalesce(item->>'athlete_name',''))>200 or pg_column_size(item)>100000 then raise exception 'Invalid activity'; end if;
  if item ? 'media' then
   if jsonb_typeof(item->'media') is distinct from 'array' or jsonb_array_length(item->'media')>10 then raise exception 'Invalid media'; end if;
   if exists(select 1 from jsonb_array_elements(item->'media') photo where
    jsonb_typeof(photo) is distinct from 'object' or
    jsonb_typeof(photo->'url') is distinct from 'string' or jsonb_typeof(photo->'thumbnail_url') is distinct from 'string' or
    jsonb_typeof(photo->'caption') is distinct from 'string' or jsonb_typeof(photo->'id') is distinct from 'string' or
    coalesce(photo->>'url','') !~ '^https://dgtzuqphqg23d\.cloudfront\.net/' or
    coalesce(photo->>'thumbnail_url','') !~ '^https://dgtzuqphqg23d\.cloudfront\.net/' or
    length(photo->>'url')>4096 or length(photo->>'thumbnail_url')>4096 or
    length(coalesce(photo->>'caption',''))>200 or length(coalesce(photo->>'id',''))>100
   ) then raise exception 'Invalid media URL'; end if;
  end if;
  observed=null;
  if item ? 'media' then
   observed=(item->>'media_observed_at')::timestamptz;
   if observed is null or observed>now()+interval '5 minutes' then raise exception 'Invalid media observation time'; end if;
  end if;
  insert into public.club_activities(activity_id,athlete_id,athlete_name,name,sport_type,start_local,distance_m,elapsed_seconds,source_steps,steps,division_id,people_count,source)
  values((item->>'activity_id')::bigint,(item->>'athlete_id')::bigint,coalesce(item->>'athlete_name',''),coalesce(item->>'name',''),coalesce(item->>'sport_type','Unknown'),(item->>'start_local')::timestamp,
  (item->>'distance_m')::numeric,(item->>'elapsed_seconds')::numeric,(item->>'steps')::integer,(item->>'steps')::integer,(item->>'division')::smallint,
  case when (item->>'people_count')::numeric between 1 and 100 then (item->>'people_count')::smallint else null end,item-'status'-'points'-'note'-'reviewed_by'-'reviewed_at'-'media'-'media_observed_at')
  on conflict(activity_id) do nothing;
  get diagnostics affected=row_count;inserted:=inserted+affected;
  -- Refresh media only; reviewed steps, attribution, points and revision remain untouched.
  if item ? 'media' then
   update public.club_activities set media=item->'media',media_observed_at=observed
   where activity_id=(item->>'activity_id')::bigint and athlete_id=(item->>'athlete_id')::bigint
    and (media_observed_at is null or media_observed_at<=observed);
  end if;
 end loop;
 insert into public.audit_log(actor_id,action,entity_id,after_data) values(null,'import_activities','2368312',jsonb_build_object('source','extension','inserted',inserted,'skipped',total-inserted));
 return jsonb_build_object('inserted',inserted,'skipped',total-inserted);
end;
$$;
revoke execute on function public.import_extension_activities(jsonb,text) from public;
grant execute on function public.import_extension_activities(jsonb,text) to anon,authenticated;
-- Member club view includes all statuses; internal fields remain excluded.
create or replace function public.get_member_activities(
  activity_scope text default 'mine', search_text text default '', division_filter smallint default null,
  group_filter smallint default null, status_filter text default 'all', page_number integer default 1, page_size integer default 10
) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare own_athlete bigint; result jsonb;
begin
  select strava_athlete_id into own_athlete from public.members where auth_user_id=auth.uid() and active;
  if own_athlete is null then raise exception 'Liên kết thành viên đang tham gia trước khi xem hoạt động.' using errcode='42501'; end if;
  if activity_scope not in ('mine','club') or activity_scope is null or status_filter not in ('all','pending','approved','rejected') or status_filter is null then raise exception 'Invalid filter'; end if;
  if page_number is null or page_number<1 or page_number>10000 or page_size is null or page_size<1 or page_size>50 then raise exception 'Invalid pagination'; end if;
  if length(coalesce(search_text,''))>200 then raise exception 'Search too long'; end if;
  with scoped as (
    select a.activity_id,a.athlete_id,coalesce(nullif(m.btn_name,''),a.athlete_name) as athlete_name,a.name,a.sport_type,a.start_local,
      a.steps,a.people_count,a.division_id,coalesce(a.group_id,m.group_id) as group_id,a.status,a.points,a.media,
      case when a.athlete_id=own_athlete and a.status='rejected' then coalesce(nullif(a.rejection_reason,''),'Hoạt động chưa được công nhận. Vui lòng liên hệ admin để được hướng dẫn.') else '' end as rejection_reason
    from public.club_activities a left join public.members m on m.strava_athlete_id=a.athlete_id
    where ((activity_scope='mine' and a.athlete_id=own_athlete) or activity_scope='club')
      and (division_filter is null or a.division_id=division_filter)
      and (group_filter is null or coalesce(a.group_id,m.group_id)=group_filter)
      and (coalesce(btrim(search_text),'')='' or position(lower(btrim(search_text)) in lower(a.name||' '||a.athlete_name||' '||coalesce(m.btn_name,'')||' '||a.activity_id::text))>0)
  ), visible as (select * from scoped where status_filter='all' or status=status_filter), paged as (
    select * from visible order by start_local desc,activity_id desc limit page_size offset (page_number-1)*page_size
  )
  select jsonb_build_object(
    'rows',coalesce((select jsonb_agg(to_jsonb(paged) order by start_local desc,activity_id desc) from paged),'[]'::jsonb),
    'total',(select count(*) from visible),
    'approved_points',coalesce((select sum(points) from scoped where status='approved'),0),
    'pending_points',coalesce((select sum(round(steps*(1+case when people_count>1 then people_count::numeric/10 else 0 end))) from scoped where status='pending' and steps is not null and people_count is not null and sport_type='Walk' and start_local>='2026-10-04' and start_local<'2026-11-16'),0)
  ) into result;
  return result;
end;
$$;
revoke all on function public.get_member_activities(text,text,smallint,smallint,text,integer,integer) from public,anon;
grant execute on function public.get_member_activities(text,text,smallint,smallint,text,integer,integer) to authenticated;
-- Top post kudos have a dedicated view; preserve the existing eligibility and authorization.
create or replace function public.get_kudos_rankings(ranking_period text default 'event') returns jsonb
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
  select p.post_id,p.title,coalesce(nullif(m.btn_name,''),nullif(m.strava_name,''),nullif(p.athlete_name,''),'Thành viên Strava') name,p.kudos_count kudos,p.posted_at,p.division_id,p.group_id,images.media
  from eligible p left join public.members m on m.strava_athlete_id=p.athlete_id
  left join lateral (
   select coalesce(jsonb_agg(photo order by activity_id,image_index),'[]'::jsonb) media from (
    select distinct on (photo->>'url') a.activity_id,image_index,photo from public.club_activities a
    cross join lateral jsonb_array_elements(a.media) with ordinality as image(photo,image_index)
    where a.activity_id=any(p.activity_ids) and a.status in('pending','approved') and a.sport_type='Walk' and a.start_local>='2026-10-04' and a.start_local<'2026-11-16'
    order by photo->>'url',a.activity_id,image_index limit 10
   ) selected
  ) images on true where p.kudos_count>0 order by p.kudos_count desc,p.post_id desc limit 10
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
