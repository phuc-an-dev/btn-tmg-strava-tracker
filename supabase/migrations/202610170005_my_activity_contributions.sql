-- Self contributions use the same approved step and attribution snapshots as statistics.
create function public.get_my_activity_contributions(stat_period text default 'week')
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare
 today date:=(now() at time zone 'Asia/Ho_Chi_Minh')::date;
 first_day date; last_day date; member_id bigint; own_group smallint; own_division smallint; group_name text; result jsonb;
begin
 if auth.uid() is null or not public.is_participant() then raise exception 'Participant access required' using errcode='42501'; end if;
 if stat_period is null or stat_period not in('week','event') then raise exception 'Invalid statistics period'; end if;
 if stat_period='week' then
  first_day:=greatest(date_trunc('week',today::timestamp)::date,'2026-10-04'::date);
  last_day:=least(date_trunc('week',today::timestamp)::date+6,today-1,'2026-11-15'::date);
 else
  first_day:='2026-10-04'; last_day:=least(today-1,'2026-11-15'::date);
 end if;
 select m.strava_athlete_id,m.group_id,m.division_id,g.name into member_id,own_group,own_division,group_name
 from public.members m left join public.small_groups g on g.id=m.group_id where m.auth_user_id=auth.uid();
 with daily as (
  select a.start_local::date activity_day,sum(a.steps)::bigint total,
   coalesce(sum(a.steps) filter(where a.athlete_id=member_id),0)::bigint individual,
   coalesce(sum(a.steps) filter(where a.group_id=own_group),0)::bigint group_steps,
   coalesce(sum(a.steps) filter(where a.division_id=own_division),0)::bigint division
  from public.club_activities a
  where a.status='approved' and a.sport_type='Walk'
   and a.start_local>=first_day::timestamp and a.start_local<(last_day+1)::timestamp
  group by a.start_local::date
 ), days as (select first_day+i activity_day from generate_series(0,last_day-first_day) i)
 select jsonb_build_object('period',stat_period,'today',today,
  'member',case when member_id is null then null else jsonb_build_object('id',member_id,'group_id',own_group,'division_id',own_division,'group_name',group_name) end,
  'days',coalesce((select jsonb_agg(jsonb_build_object('date',d.activity_day,'total',coalesce(a.total,0),
   'individual',case when member_id is null then null else coalesce(a.individual,0) end,
   'group',case when own_group is null then null else coalesce(a.group_steps,0) end,
   'division',case when own_division is null then null else coalesce(a.division,0) end) order by d.activity_day)
   from days d left join daily a on a.activity_day=d.activity_day),'[]'::jsonb)) into result;
 return result;
end;
$$;
revoke all on function public.get_my_activity_contributions(text) from public,anon;
grant execute on function public.get_my_activity_contributions(text) to authenticated;
