begin;
-- Isolated fixtures only. The transaction rolls back every review and audit entry.
select set_config('request.jwt.claim.sub',(select id::text from public.profiles where role='admin' limit 1),true);
insert into public.members(strava_athlete_id,strava_name,group_id,division_id,active,source_url,synced_at)
select x.id,'Review assignment test',case when x.assigned then g.id end,case when x.assigned then g.division_id end,x.active,'https://www.strava.com/clubs/2368312/members',now()
from (values (999999999999971::bigint,true,true),(999999999999972,false,true),(999999999999973,true,false)) x(id,assigned,active)
cross join lateral (select id,division_id from public.small_groups where division_id is not null order by id limit 1) g;
insert into public.club_activities(activity_id,athlete_id,athlete_name,name,sport_type,start_local,steps,source_steps,people_count,division_id,source)
select x.id,x.athlete,'Review assignment test',x.name,'Walk','2026-10-13 12:00',2866,2866,1,x.division,jsonb_build_object('division',x.division)
from (values
 (999999999999971::bigint,999999999999971::bigint,'NĐ3_1_2866',null::smallint),
 (999999999999972,999999999999971,'Wrong title division',((select division_id%5+1 from public.members where strava_athlete_id=999999999999971))::smallint),
 (999999999999973,999999999999972,'Unassigned member',null),
 (999999999999974,999999999999973,'Inactive member',null),
 (999999999999975,999999999999971,'Validation checks',null)
) x(id,athlete,name,division);
set local role authenticated;
select public.review_club_activity(999999999999971,1,2866,1::smallint,null::smallint,'','approved');
-- Even an incorrect client/title division cannot redirect credited points.
select public.review_club_activity(999999999999972,1,2866,1::smallint,((select division_id%5+1 from public.members where strava_athlete_id=999999999999971))::smallint,'','approved');
do $$ begin
 if exists(select 1 from public.club_activities a join public.members m on m.strava_athlete_id=a.athlete_id
   where a.activity_id in(999999999999971,999999999999972)
     and (a.division_id is distinct from m.division_id or a.group_id is distinct from m.group_id or a.status<>'approved' or a.points<>2866)) then
  raise exception 'Roster attribution or points incorrect';
 end if;
 if not exists(select 1 from public.club_activities where activity_id=999999999999971 and name='NĐ3_1_2866' and source->'division'='null'::jsonb) then
  raise exception 'Original title/source overwritten';
 end if;
 if not exists(select 1 from public.audit_log where action='review_activity' and entity_id='999999999999971'
   and before_data->>'division_id' is null and after_data->>'group_id' is not null and after_data->>'division_id' is not null) then
  raise exception 'Assignment audit missing';
 end if;
 begin
  perform public.review_club_activity(999999999999971,1,2866,1::smallint,null::smallint,'','approved');
  raise exception 'Stale revision accepted';
 exception when raise_exception then if SQLERRM not like 'Activity changed%' then raise; end if; end;
 begin
  perform public.review_club_activity(999999999999973,1,2866,1::smallint,null::smallint,'','approved');
  raise exception 'Unassigned member approved';
 exception when raise_exception then if SQLERRM not like 'Assign this member%' then raise; end if; end;
 begin
  perform public.review_club_activity(999999999999974,1,2866,1::smallint,null::smallint,'','approved');
  raise exception 'Inactive member approved';
 exception when raise_exception then if SQLERRM not like 'Assign this member%' then raise; end if; end;
 begin
  perform public.review_club_activity(999999999999975,1,2866,null::smallint,null::smallint,'','approved');
  raise exception 'Missing party size approved';
 exception when raise_exception then if SQLERRM not like 'Steps and party size%' then raise; end if; end;
 begin
  perform public.review_club_activity(999999999999975,1,2866,0::smallint,null::smallint,'','approved');
  raise exception 'Invalid party size approved';
 exception when check_violation then null; end;
 begin
  perform public.review_club_activity(999999999999975,1,3000,1::smallint,null::smallint,'','approved');
  raise exception 'Corrected steps accepted without note';
 exception when raise_exception then if SQLERRM not like 'Explain corrected%' then raise; end if; end;
end $$;
reset role;
-- A roster move does not rewrite activities already credited to a group.
update public.members m set group_id=g.id,division_id=g.division_id
from (select id,division_id from public.small_groups where division_id is not null
 and division_id<>(select division_id from public.members where strava_athlete_id=999999999999971) order by id limit 1) g
where m.strava_athlete_id=999999999999971;
do $$ begin
 if not exists(select 1 from public.club_activities a join public.members m on m.strava_athlete_id=a.athlete_id
   where a.activity_id=999999999999971 and a.group_id<>m.group_id and a.division_id<>m.division_id and a.points=2866) then
  raise exception 'Historical attribution changed, or test needs two assigned divisions';
 end if;
end $$;
set local role authenticated;
-- An explicit new review uses the latest assignment, even with an old client value.
select public.review_club_activity(999999999999971,2,2866,1::smallint,null::smallint,'Reviewed after roster move','approved');
do $$ begin
 if exists(select 1 from public.club_activities a join public.members m on m.strava_athlete_id=a.athlete_id
   where a.activity_id=999999999999971 and (a.division_id is distinct from m.division_id or a.group_id is distinct from m.group_id)) then
  raise exception 'Review used stale roster assignment';
 end if;
end $$;
-- Pending and rejection remain available without a valid roster assignment.
select public.review_club_activity(999999999999973,1,2866,1::smallint,null::smallint,'Awaiting assignment','pending');
select public.review_club_activity(999999999999973,2,2866,1::smallint,null::smallint,'','rejected','Please contact the admin.');
reset role;
update public.club_activities set sport_type='Run' where activity_id=999999999999975;
set local role authenticated;
do $$ begin
 begin
  perform public.review_club_activity(999999999999975,1,2866,1::smallint,null::smallint,'','approved');
  raise exception 'Run approved';
 exception when raise_exception then if SQLERRM not like 'Activity is outside%' then raise; end if; end;
 if has_function_privilege('anon','public.review_club_activity(bigint,integer,integer,smallint,smallint,text,text,text)','execute') then
  raise exception 'Anonymous review access granted';
 end if;
end $$;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000099',true);
do $$ begin
 begin
  perform public.review_club_activity(999999999999975,1,2866,1::smallint,null::smallint,'','approved');
  raise exception 'Non-admin review accepted';
 exception when insufficient_privilege then null; end;
end $$;
rollback;
