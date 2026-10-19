-- Default to the top five and only include completed local dates.
-- Group attribution remains the snapshot saved on review.
create or replace function public.get_activity_statistics(stat_scope text default 'individuals',stat_period text default 'week',entity_ids bigint[] default '{}')
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare
 today date:=(now() at time zone 'Asia/Ho_Chi_Minh')::date;
 first_day date; last_day date; result jsonb;
begin
 if auth.uid() is null then raise exception 'Sign in required' using errcode='42501'; end if;
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
 ), days as (select first_day+i activity_day from generate_series(0,last_day-first_day) i),
 series as (
  select p.id,p.name,p.ordinal,coalesce(t.steps,0) total,
   (select jsonb_agg(case when d.activity_day>=today or d.activity_day<'2026-10-04'::date or d.activity_day>'2026-11-15'::date then 'null'::jsonb
    else to_jsonb(coalesce(a.steps,0)) end order by d.activity_day)
    from days d left join daily a on a.id=p.id and a.activity_day=d.activity_day) daily_values
  from picked p left join totals t on t.id=p.id
 )
 select jsonb_build_object('scope',stat_scope,'period',stat_period,'today',today,'start_date',first_day,'end_date',last_day,
  'days',(select jsonb_agg(activity_day order by activity_day) from days),
  'series',coalesce((select jsonb_agg(jsonb_build_object('id',id,'name',name,'total',total,'values',daily_values) order by ordinal) from series),'[]'::jsonb)) into result;
 if cardinality(entity_ids)>0 and jsonb_array_length(result->'series')<>cardinality(entity_ids) then raise exception 'Unknown statistics entity'; end if;
 return result;
end;
$$;
revoke all on function public.get_activity_statistics(text,text,bigint[]) from public,anon;
grant execute on function public.get_activity_statistics(text,text,bigint[]) to authenticated;
