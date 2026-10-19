-- Public viewing uses bounded read RPCs; account tables and every mutation retain their existing authorization.
create function public.get_public_portal() returns jsonb
language sql stable security definer set search_path='' as $$
 select jsonb_build_object(
  'members',coalesce((select jsonb_agg(jsonb_build_object('strava_athlete_id',m.strava_athlete_id,'strava_name',m.strava_name,'btn_name',m.btn_name,'division_id',m.division_id,'group_id',m.group_id,'synced_at',m.synced_at,'active',m.active) order by m.strava_name,m.strava_athlete_id) from public.members m),'[]'::jsonb),
  'groups',coalesce((select jsonb_agg(jsonb_build_object('id',g.id,'name',g.name,'division_id',g.division_id) order by g.id) from public.small_groups g),'[]'::jsonb)
 );
$$;
revoke all on function public.get_public_portal() from public;
grant execute on function public.get_public_portal() to anon,authenticated;


create or replace function public.get_rankings(ranking_period text default 'event') returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare result jsonb; week_start timestamp;
begin
 if ranking_period is null or ranking_period not in('event','week') then raise exception 'Invalid period'; end if;
 week_start=date_trunc('week',now() at time zone 'Asia/Ho_Chi_Minh');
 with eligible as (
  select a.* from public.club_activities a where a.status='approved' and a.sport_type='Walk' and a.start_local>='2026-10-04' and a.start_local<'2026-11-16'
 ), scoped as (
  select * from eligible where ranking_period='event' or (start_local>=week_start and start_local<week_start+interval '7 days')
 ), lifetime as (
  select athlete_id,sum(steps) lifetime_steps,count(distinct start_local::date) lifetime_days from eligible group by athlete_id
 ), people as (
  select a.athlete_id,coalesce(nullif(btrim(m.btn_name),''),nullif(btrim(m.strava_name),''),max(nullif(a.athlete_name,'')),'Thành viên Strava') name,
   m.division_id,m.group_id,case when p.gender in('male','female') then p.gender else null end gender,
   coalesce(m.auth_user_id=auth.uid(),false) is_me,sum(a.steps) steps,sum(a.points) points,count(*) activities,count(distinct a.start_local::date) days,
   l.lifetime_steps,l.lifetime_days
  from scoped a left join public.members m on m.strava_athlete_id=a.athlete_id left join public.profiles p on p.id=m.auth_user_id
  join lifetime l on l.athlete_id=a.athlete_id
  group by a.athlete_id,m.btn_name,m.strava_name,m.division_id,m.group_id,p.gender,m.auth_user_id,l.lifetime_steps,l.lifetime_days
 ), group_sizes as (
  select group_id,count(*) members,count(*) filter(where exists(select 1 from scoped a where a.athlete_id=m.strava_athlete_id)) participants
  from public.members m where active and group_id is not null group by group_id
 ), group_scores as (
  select group_id,sum(steps) steps,sum(points) points,count(*) activities from scoped group by group_id
 ), groups as (
  select g.id,'Nhóm '||g.id name,g.division_id,coalesce(s.steps,0) steps,coalesce(s.points,0) points,coalesce(s.activities,0) activities,
   coalesce(z.members,0) members,coalesce(z.participants,0) participants
  from public.small_groups g left join group_sizes z on z.group_id=g.id left join group_scores s on s.group_id=g.id
 ), division_sizes as (
  select division_id,count(*) members,count(*) filter(where exists(select 1 from scoped a where a.athlete_id=m.strava_athlete_id)) participants
  from public.members m where active and division_id is not null group by division_id
 ), division_scores as (
  select division_id,sum(steps) steps,sum(points) points,count(*) activities from scoped group by division_id
 ), divisions as (
  select d.id,'LĐ '||d.id name,d.id division_id,coalesce(s.steps,0) steps,coalesce(s.points,0) points,coalesce(s.activities,0) activities,
   coalesce(z.members,0) members,coalesce(z.participants,0) participants
  from public.divisions d left join division_sizes z on z.division_id=d.id left join division_scores s on s.division_id=d.id
 )
 select jsonb_build_object(
  'individuals',coalesce((select jsonb_agg(to_jsonb(p) order by steps desc,athlete_id) from people p),'[]'::jsonb),
  'groups',coalesce((select jsonb_agg(to_jsonb(g) order by points desc,id) from groups g),'[]'::jsonb),
  'divisions',coalesce((select jsonb_agg(to_jsonb(d) order by points desc,id) from divisions d),'[]'::jsonb),
  'summary',jsonb_build_object('steps',coalesce((select sum(steps) from scoped),0),'points',coalesce((select sum(points) from scoped),0),
   'activities',(select count(*) from scoped),'participants',(select count(*) from people),'roster',(select count(*) from public.members where active),
   'with_gender',(select count(*) from people where gender is not null))
 ) into result;
 return result;
end;
$$;

revoke all on function public.get_rankings(text) from public;
grant execute on function public.get_rankings(text) to anon,authenticated;

create or replace function public.get_kudos_rankings(ranking_period text default 'event') returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare result jsonb; week_start timestamp;
begin
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

revoke all on function public.get_kudos_rankings(text) from public;
grant execute on function public.get_kudos_rankings(text) to anon,authenticated;

create or replace function public.get_activity_statistics(stat_scope text default 'individuals',stat_period text default 'week',entity_ids bigint[] default '{}')
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare
 today date:=(now() at time zone 'Asia/Ho_Chi_Minh')::date;
 first_day date; last_day date; result jsonb;
begin
 if stat_scope is null or stat_scope not in('individuals','groups','divisions') or stat_period is null or stat_period not in('week','event') then raise exception 'Invalid statistics filter'; end if;
 if entity_ids is null or cardinality(entity_ids)>5 or coalesce(array_ndims(entity_ids),1)<>1
  or exists(select 1 from unnest(entity_ids) id where id is null or id<1 or id>999999999999999)
  or (select count(distinct id) from unnest(entity_ids) id)<>cardinality(entity_ids) then raise exception 'Select up to five distinct entities'; end if;
 if stat_period='week' then
  first_day:=date_trunc('week',today::timestamp)::date; last_day:=first_day+6;
 else
  first_day:='2026-10-04'; last_day:=greatest(first_day+3,least(today-1,'2026-11-15'::date));
 end if;
 with eligible as (
  select a.athlete_id,a.athlete_name,a.group_id,a.division_id,a.start_local::date activity_day,a.steps
  from public.club_activities a where a.status='approved' and a.sport_type='Walk'
   and a.start_local>='2026-10-04' and a.start_local<'2026-11-16'
   and a.start_local>=first_day::timestamp and a.start_local<(last_day+1)::timestamp
   and a.start_local<today::timestamp
 ), entities as (
  select m.strava_athlete_id id,coalesce(nullif(btrim(m.btn_name),''),nullif(btrim(m.strava_name),''),'Thành viên Strava') name
   from public.members m where stat_scope='individuals'
  union all
  select a.athlete_id,max(coalesce(nullif(btrim(a.athlete_name),''),'Thành viên Strava')) from eligible a
   where stat_scope='individuals' and not exists(select 1 from public.members m where m.strava_athlete_id=a.athlete_id) group by a.athlete_id
  union all select g.id::bigint,'Nhóm '||g.id from public.small_groups g where stat_scope='groups'
  union all select d.id::bigint,'LĐ '||d.id from public.divisions d where stat_scope='divisions'
 ), daily as (
  select case stat_scope when 'individuals' then athlete_id when 'groups' then group_id::bigint else division_id::bigint end id,
   activity_day,sum(steps)::bigint steps from eligible group by 1,2
 ), totals as (select id,sum(steps)::bigint steps from daily group by id),
 picked as (
  select e.id,e.name,p.ordinality ordinal from unnest(entity_ids) with ordinality p(id,ordinality) join entities e on e.id=p.id
  union all
  select * from (select e.id,e.name,row_number() over(order by
    case when stat_scope='divisions' then e.id end,coalesce(t.steps,0) desc,e.id) ordinal
   from entities e left join totals t on t.id=e.id where cardinality(entity_ids)=0
   order by ordinal limit 5) default_pick
 ), chart_range as (
  select case when stat_period='week' then max(d.activity_day) else last_day end end_date
  from daily d join picked p on p.id=d.id
 ), days as (select first_day+i activity_day from chart_range r cross join lateral generate_series(0,r.end_date-first_day) i),
 series as (
  select p.id,p.name,p.ordinal,coalesce(t.steps,0) total,
   (select jsonb_agg(case when d.activity_day>=today or d.activity_day<'2026-10-04'::date or d.activity_day>'2026-11-15'::date then 'null'::jsonb
    else to_jsonb(coalesce(a.steps,0)) end order by d.activity_day)
    from days d left join daily a on a.id=p.id and a.activity_day=d.activity_day) daily_values
  from picked p left join totals t on t.id=p.id
 )
 select jsonb_build_object('scope',stat_scope,'period',stat_period,'today',today,'start_date',first_day,'end_date',coalesce((select max(activity_day) from days),last_day),
  'days',coalesce((select jsonb_agg(activity_day order by activity_day) from days),'[]'::jsonb),
  'series',coalesce((select jsonb_agg(jsonb_build_object('id',id,'name',name,'total',total,'values',coalesce(daily_values,'[]'::jsonb)) order by ordinal) from series),'[]'::jsonb)) into result;
 if cardinality(entity_ids)>0 and jsonb_array_length(result->'series')<>cardinality(entity_ids) then raise exception 'Unknown statistics entity'; end if;
 return result;
end;
$$;

revoke all on function public.get_activity_statistics(text,text,bigint[]) from public;
grant execute on function public.get_activity_statistics(text,text,bigint[]) to anon,authenticated;

create or replace function public.get_member_activities(
  activity_scope text default 'mine', search_text text default '', division_filter smallint default null,
  group_filter smallint default null, status_filter text default 'all', page_number integer default 1, page_size integer default 10
) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare own_athlete bigint; result jsonb;
begin
  select strava_athlete_id into own_athlete from public.members where auth_user_id=auth.uid() and active;
  if activity_scope='mine' and own_athlete is null then raise exception 'Liên kết thành viên đang tham gia trước khi xem hoạt động.' using errcode='42501'; end if;
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

revoke all on function public.get_member_activities(text,text,smallint,smallint,text,integer,integer) from public;
grant execute on function public.get_member_activities(text,text,smallint,smallint,text,integer,integer) to anon,authenticated;

create or replace function public.get_incomplete_post_page(report_scope text default 'mine',search_text text default '',division_filter smallint default null,group_filter smallint default null,page_number integer default 1,count_only boolean default false)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare own_athlete bigint; result jsonb;
begin
 if report_scope is null or report_scope not in('mine','club') or length(coalesce(search_text,''))>200 then raise exception 'Invalid request' using errcode='42501'; end if;
 if page_number is null or page_number<1 or page_number>10000 or count_only is null then raise exception 'Invalid pagination'; end if;
 select strava_athlete_id into own_athlete from public.members where auth_user_id=auth.uid() and active;
 if report_scope='mine' and own_athlete is null then raise exception 'Link an active member first' using errcode='42501'; end if;
 with scoped as (
  select p.post_id,p.athlete_id,coalesce(nullif(btrim(m.btn_name),''),nullif(btrim(p.athlete_name),''),nullif(btrim(m.strava_name),''),'') athlete_name,p.title,p.posted_at,m.division_id,m.group_id
  from public.club_incomplete_posts p left join public.members m on m.strava_athlete_id=p.athlete_id
  where not p.resolved and p.missing_since is null and (report_scope='club' or p.athlete_id=own_athlete)
   and (division_filter is null or m.division_id=division_filter) and (group_filter is null or m.group_id=group_filter)
   and (coalesce(btrim(search_text),'')='' or position(lower(btrim(search_text)) in lower(p.title||' '||p.athlete_name||' '||coalesce(m.btn_name,'')||' '||coalesce(m.strava_name,'')||' '||p.post_id::text))>0)
 ), paged as (select * from scoped where not count_only order by posted_at desc nulls last,post_id desc limit 10 offset (page_number-1)*10), images as (
  select p.*,coalesce(d.media,'[]'::jsonb) media from paged p left join public.club_discussion_posts d on d.post_id=p.post_id and d.athlete_id=p.athlete_id
 ) select jsonb_build_object('rows',coalesce((select jsonb_agg(to_jsonb(i) order by posted_at desc nulls last,post_id desc) from images i),'[]'::jsonb),'total',(select count(*) from scoped)) into result;
 return result;
end;
$$;

revoke all on function public.get_incomplete_post_page(text,text,smallint,smallint,integer,boolean) from public;
grant execute on function public.get_incomplete_post_page(text,text,smallint,smallint,integer,boolean) to anon,authenticated;
