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
  select p.post_id,p.title,coalesce(nullif(m.btn_name,''),nullif(m.strava_name,''),nullif(p.athlete_name,''),'Thành viên Strava') name,p.kudos_count kudos,p.posted_at,p.division_id,p.group_id
  from eligible p left join public.members m on m.strava_athlete_id=p.athlete_id where p.kudos_count>0 order by p.kudos_count desc,p.post_id desc limit 10
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
