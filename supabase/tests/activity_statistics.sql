begin;
-- Every fixture and its attribution change is rolled back.
select set_config('request.jwt.claim.sub',(select id::text from public.profiles where role='admin' limit 1),true);
insert into public.members(strava_athlete_id,strava_name,group_id,division_id,source_url,synced_at)
select x.id,'Statistics test '||x.id,g.id,g.division_id,'https://www.strava.com/clubs/2368312/members',now()
from (values(999999999999961::bigint),(999999999999962),(999999999999963)) x(id)
cross join lateral(select id,division_id from public.small_groups where division_id is not null order by id limit 1) g;
insert into public.club_activities(activity_id,athlete_id,athlete_name,name,sport_type,start_local,steps,source_steps,people_count,division_id,group_id,status,source,reviewed_by,reviewed_at)
select x.id,x.athlete,'Statistics test','Statistics fixture','Walk',x.started,x.steps,x.steps,2,m.division_id,m.group_id,x.status,'{}',
 case when x.status='approved' then auth.uid() end,case when x.status='approved' then now() end
from (values
 (999999999999961::bigint,999999999999961::bigint,'2026-10-12 23:59:59'::timestamp,1000,'approved'),
 (999999999999962,999999999999961,'2026-10-13 00:00:01',2000,'approved'),
 (999999999999963,999999999999961,'2026-10-14 12:00',9000,'pending'),
 (999999999999964,999999999999961,'2026-10-14 12:00',8000,'rejected'),
 (999999999999965,999999999999962,'2026-10-12 12:00',4000,'approved'),
 (999999999999967,999999999999962,'2026-10-14 12:00',0,'approved'),
 (999999999999966,999999999999961,(now() at time zone 'Asia/Ho_Chi_Minh')::date+time '00:00:01',900000,'approved')
) x(id,athlete,started,steps,status) join public.members m on m.strava_athlete_id=x.athlete;
-- The roster move must not redirect historical group/LĐ totals.
update public.members m set group_id=g.id,division_id=g.division_id
from (select id,division_id from public.small_groups where division_id is not null
 and division_id<>(select division_id from public.members where strava_athlete_id=999999999999961) order by id limit 1) g
where m.strava_athlete_id=999999999999961;
set local role authenticated;
do $$ declare r jsonb; idx integer; g smallint; d smallint; expected bigint; v jsonb; i integer; stat_scope text; stat_period text; expected_ids jsonb; actual_ids jsonb; first_day date; last_day date; expected_end date; begin
 r:=public.get_activity_statistics('individuals','event',array[999999999999961::bigint]);
 if (r->'series'->0->>'total')::bigint<>3000 then raise exception 'Pending/rejected or party bonus included'; end if;
 select ordinality::int-1 into idx from jsonb_array_elements_text(r->'days') with ordinality x(value,ordinality) where value='2026-10-12';
 if idx is null or (r->'series'->0->'values'->>idx)::int<>1000 or (r->'series'->0->'values'->>(idx+1))::int<>2000 then raise exception 'Local dates aggregated incorrectly'; end if;
 if (r->'series'->0->'values'->>0)::int<>0 then raise exception 'Missing past day not zero-filled'; end if;
 if jsonb_array_length(r->'series'->0->'values')<>jsonb_array_length(r->'days') or jsonb_array_length(r->'days')<4 then raise exception 'Date grid misaligned'; end if;
 if r::text like '%reviewed_by%' or r::text like '%source_steps%' or r::text like '%email%' then raise exception 'Private fields leaked'; end if;
 r:=public.get_activity_statistics('individuals','event',array[999999999999962::bigint,999999999999961::bigint]);
 if (r->'series'->0->>'id')::bigint<>999999999999962 or (r->'series'->1->>'id')::bigint<>999999999999961 then raise exception 'Selection order not preserved'; end if;
 select group_id,division_id into g,d from public.club_activities where activity_id=999999999999961;
 if g=(select group_id from public.members where strava_athlete_id=999999999999961) then raise exception 'Test requires two assigned divisions'; end if;
 r:=public.get_activity_statistics('groups','event',array[g::bigint]);
 select coalesce(sum(steps),0) into expected from public.club_activities where group_id=g and status='approved' and sport_type='Walk'
  and start_local>='2026-10-04' and start_local<'2026-11-16' and start_local<((now() at time zone 'Asia/Ho_Chi_Minh')::date)::timestamp;
 if (r->'series'->0->>'total')::bigint<>expected then raise exception 'Group used current member assignment or points'; end if;
 r:=public.get_activity_statistics('divisions','event',array[d::bigint]);
 select coalesce(sum(steps),0) into expected from public.club_activities where division_id=d and status='approved' and sport_type='Walk'
  and start_local>='2026-10-04' and start_local<'2026-11-16' and start_local<((now() at time zone 'Asia/Ho_Chi_Minh')::date)::timestamp;
 if (r->'series'->0->>'total')::bigint<>expected then raise exception 'Division used current member assignment or points'; end if;
 r:=public.get_activity_statistics('divisions','week',array[5,4,3,2,1]::bigint[]);
 if jsonb_array_length(r->'series')<>5 then raise exception 'Five-series week unsupported'; end if;
 for i in 0..jsonb_array_length(r->'days')-1 loop
  if (r->'days'->>i)::date>=(r->>'today')::date and r->'series'->0->'values'->i<>'null'::jsonb then raise exception 'Current or future day rendered as zero'; end if;
 end loop;
 -- A selected entity without approved activities has no invented chart dates.
 r:=public.get_activity_statistics('individuals','week',array[999999999999963::bigint]);
 if r->'days'<>'[]'::jsonb or r->'series'->0->'values'<>'[]'::jsonb or (r->'series'->0->>'total')::bigint<>0 then raise exception 'Empty week invented dates or values'; end if;
 if date_trunc('week',(now() at time zone 'Asia/Ho_Chi_Minh'))::date='2026-10-12' then
  r:=public.get_activity_statistics('individuals','week',array[999999999999961::bigint]);
  if r->>'end_date'<>'2026-10-13' or jsonb_array_length(r->'days')<>2 then raise exception 'Week extended by unselected, pending, rejected or current activities'; end if;
  r:=public.get_activity_statistics('individuals','week',array[999999999999962::bigint]);
  if r->>'end_date'<>'2026-10-14' or r->'series'->0->'values'<>'[4000,0,0]'::jsonb then raise exception 'Zero-step approved activity or inner zero day lost'; end if;
  r:=public.get_activity_statistics('individuals','week',array[999999999999961::bigint,999999999999962::bigint]);
  if r->>'end_date'<>'2026-10-14' or jsonb_array_length(r->'days')<>3 or r->'series'->0->'values'<>'[1000,2000,0]'::jsonb then raise exception 'Selected entities do not share one aligned date range'; end if;
 end if;
 -- Default selection follows the selected period, excludes today, and keeps LĐ order stable.
 foreach stat_scope in array array['individuals','groups','divisions'] loop
  foreach stat_period in array array['week','event'] loop
   r:=public.get_activity_statistics(stat_scope,stat_period,'{}');
   first_day:=(r->>'start_date')::date; last_day:=(r->>'end_date')::date;
   if stat_period='week' then
    select max(a.start_local::date) into expected_end from public.club_activities a
    where a.status='approved' and a.sport_type='Walk'
     and a.start_local>='2026-10-04' and a.start_local<'2026-11-16'
     and a.start_local>=first_day::timestamp and a.start_local<(first_day+7)::timestamp and a.start_local<(r->>'today')::date::timestamp
     and case stat_scope when 'individuals' then a.athlete_id when 'groups' then a.group_id::bigint else a.division_id::bigint end
      in(select (value->>'id')::bigint from jsonb_array_elements(r->'series'));
    if jsonb_array_length(r->'days')<>coalesce(expected_end-first_day+1,0) or (expected_end is not null and last_day<>expected_end) then raise exception 'Weekly range does not match selected approved activity: %',stat_scope; end if;
   end if;
   with entities as (
    select strava_athlete_id id from public.members where stat_scope='individuals'
    union select athlete_id from public.club_activities where stat_scope='individuals'
     and status='approved' and sport_type='Walk' and start_local>='2026-10-04' and start_local<'2026-11-16'
     and start_local>=first_day::timestamp and start_local<(last_day+1)::timestamp and start_local<(r->>'today')::date::timestamp
    union select id::bigint from public.small_groups where stat_scope='groups'
    union select id::bigint from public.divisions where stat_scope='divisions'
   ), ranked as (
    select e.id,coalesce(sum(a.steps),0) total from entities e left join public.club_activities a
     on e.id=case stat_scope when 'individuals' then a.athlete_id when 'groups' then a.group_id::bigint else a.division_id::bigint end
     and a.status='approved' and a.sport_type='Walk' and a.start_local>='2026-10-04' and a.start_local<'2026-11-16'
     and a.start_local>=first_day::timestamp and a.start_local<(last_day+1)::timestamp and a.start_local<(r->>'today')::date::timestamp
    group by e.id
   ), top_five as (select id,row_number() over(order by case when stat_scope='divisions' then id end,total desc,id) position from ranked)
   select jsonb_agg(id order by position) into expected_ids from top_five where position<=5;
   select jsonb_agg(value->'id' order by ordinality) into actual_ids from jsonb_array_elements(r->'series') with ordinality;
   if actual_ids is distinct from expected_ids or jsonb_array_length(r->'series')<>5 then raise exception 'Default top five incorrect: % / %',stat_scope,stat_period; end if;
   for v in select value from jsonb_array_elements(r->'series') loop
    if (select coalesce(sum(value::bigint),0) from jsonb_array_elements_text(v->'values')) is distinct from (v->>'total')::bigint then raise exception 'Series total differs from completed daily values'; end if;
    for i in 0..jsonb_array_length(r->'days')-1 loop
     if (r->'days'->>i)::date>=(r->>'today')::date and v->'values'->i<>'null'::jsonb then raise exception 'Default includes current date'; end if;
    end loop;
   end loop;
  end loop;
 end loop;
 begin
  perform public.get_activity_statistics('divisions','event',array[1,2,3,4,5,6]::bigint[]);raise exception 'Six entities accepted';
 exception when raise_exception then if SQLERRM not like 'Select up to five%' then raise; end if;end;
 begin
  perform public.get_activity_statistics('groups','event',array[1,1]::bigint[]);raise exception 'Duplicate entities accepted';
 exception when raise_exception then if SQLERRM not like 'Select up to five%' then raise; end if;end;
 begin
  perform public.get_activity_statistics('all','event','{}');raise exception 'Invalid scope accepted';
 exception when raise_exception then if SQLERRM not like 'Invalid statistics%' then raise; end if;end;
 begin
  perform public.get_activity_statistics('groups','event',array[999]::bigint[]);raise exception 'Unknown ID accepted';
 exception when raise_exception then if SQLERRM not like 'Unknown statistics%' then raise; end if;end;
 if has_function_privilege('anon','public.get_activity_statistics(text,text,bigint[])','execute') then raise exception 'Anonymous execute granted'; end if;
end $$;
select set_config('request.jwt.claim.sub','',true);
do $$ begin
 begin perform public.get_activity_statistics();raise exception 'Signed-out access allowed';
 exception when insufficient_privilege then null;end;
end $$;
rollback;
