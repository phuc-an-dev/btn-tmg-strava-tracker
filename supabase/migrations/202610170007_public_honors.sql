-- Public podium: only display names, public team IDs and approved aggregate scores.
-- Keep the event bounds, metrics and tie ordering identical to get_rankings('event').
create function public.get_honors(honor_scope text default 'individuals') returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare podium jsonb;
begin
 if honor_scope is null or honor_scope not in ('individuals','divisions') then
  raise exception 'Invalid scope' using errcode='22023';
 end if;
 if honor_scope='individuals' then
  with people as (
   select a.athlete_id id,
    coalesce(nullif(btrim(m.btn_name),''),nullif(btrim(m.strava_name),''),max(nullif(a.athlete_name,'')),'Thành viên Strava') name,
    m.division_id,m.group_id,sum(a.steps) score
   from public.club_activities a left join public.members m on m.strava_athlete_id=a.athlete_id
   where a.status='approved' and a.sport_type='Walk' and a.start_local>='2026-10-04' and a.start_local<'2026-11-16'
   group by a.athlete_id,m.btn_name,m.strava_name,m.division_id,m.group_id
  ), winners as (select * from people where score>0 order by score desc,id limit 3)
  select coalesce(jsonb_agg(to_jsonb(w) order by score desc,id),'[]'::jsonb) into podium from winners w;
 else
  with scores as (
   select division_id,sum(points) score from public.club_activities
   where status='approved' and sport_type='Walk' and start_local>='2026-10-04' and start_local<'2026-11-16'
   group by division_id
  ), winners as (
   select d.id,'LĐ '||d.id name,s.score from public.divisions d join scores s on s.division_id=d.id
   where s.score>0 order by s.score desc,d.id limit 3
  )
  select coalesce(jsonb_agg(to_jsonb(w) order by score desc,id),'[]'::jsonb) into podium from winners w;
 end if;
 return jsonb_build_object('scope',honor_scope,'captured_at',statement_timestamp(),'winners',podium);
end;
$$;
revoke all on function public.get_honors(text) from public;
grant execute on function public.get_honors(text) to anon,authenticated;
