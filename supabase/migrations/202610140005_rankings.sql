-- Aggregate approved competition results without exposing account or review data.
create function public.get_rankings(ranking_period text default 'event') returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare result jsonb; week_start timestamp;
begin
 if auth.uid() is null then raise exception 'Sign in required' using errcode='42501'; end if;
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
revoke all on function public.get_rankings(text) from public,anon;
grant execute on function public.get_rankings(text) to authenticated;
