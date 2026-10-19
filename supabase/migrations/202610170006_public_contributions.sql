-- Public contribution aggregates expose no account, contact or raw activity data.
create function public.get_contribution_statistics(stat_scope text default 'individuals',stat_period text default 'week')
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare
 today date:=(now() at time zone 'Asia/Ho_Chi_Minh')::date;
 first_day date; last_day date; own_id bigint; result jsonb;
begin
 if stat_scope is null or stat_scope not in('individuals','groups','divisions') then raise exception 'Invalid contribution scope'; end if;
 if stat_period is null or stat_period not in('week','event') then raise exception 'Invalid contribution period'; end if;
 first_day:=case when stat_period='week' then greatest(date_trunc('week',today::timestamp)::date,'2026-10-04'::date) else '2026-10-04'::date end;
 last_day:=least(today-1,'2026-11-15'::date);
 select case stat_scope when 'individuals' then m.strava_athlete_id when 'groups' then m.group_id else m.division_id end into own_id
 from public.members m where m.auth_user_id=auth.uid() and m.active;
 with approved as materialized (
  select a.athlete_id,a.group_id,a.division_id,a.steps from public.club_activities a
  where a.status='approved' and a.sport_type='Walk' and a.start_local>=first_day::timestamp and a.start_local<(last_day+1)::timestamp
 ), totals as (
  select case stat_scope when 'individuals' then a.athlete_id when 'groups' then a.group_id else a.division_id end id,sum(a.steps)::bigint steps
  from approved a group by 1
 ), entities as (
  select m.strava_athlete_id id,coalesce(nullif(m.btn_name,''),m.strava_name) name,
   concat_ws(' · ',case when m.division_id is not null then 'LĐ '||m.division_id end,case when m.group_id is not null then 'Nhóm '||m.group_id end) detail
  from public.members m where stat_scope='individuals' and m.active
  union all select g.id,g.name,case when g.division_id is not null then 'LĐ '||g.division_id else '' end from public.small_groups g where stat_scope='groups'
  union all select i,'LĐ '||i,'' from generate_series(1,5) i where stat_scope='divisions'
 )
 select jsonb_build_object('start_date',first_day,'end_date',last_day,'own_id',own_id,
  'total',coalesce((select sum(steps) from approved),0),
  'choices',coalesce((select jsonb_agg(jsonb_build_object('id',e.id,'name',e.name,'detail',e.detail,'steps',coalesce(t.steps,0)) order by coalesce(t.steps,0) desc,e.id) from entities e left join totals t using(id)),'[]'::jsonb)) into result;
 return result;
end;
$$;
revoke all on function public.get_contribution_statistics(text,text) from public;
grant execute on function public.get_contribution_statistics(text,text) to anon,authenticated;
