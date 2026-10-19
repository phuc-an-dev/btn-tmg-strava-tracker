begin;
-- Only generated accounts and isolated activities are touched; all changes roll back.
select set_config('appeal_test.admin',gen_random_uuid()::text,true),set_config('appeal_test.member',gen_random_uuid()::text,true),set_config('appeal_test.leader',gen_random_uuid()::text,true),set_config('appeal_test.other',gen_random_uuid()::text,true);
insert into auth.users(id,email,raw_user_meta_data)
select current_setting('appeal_test.'||role)::uuid,'appeal-test-'||current_setting('appeal_test.'||role)||'@example.invalid',jsonb_build_object('full_name','Appeal test '||role)
from unnest(array['admin','member','leader','other']) role;
update public.profiles set role='admin' where id=current_setting('appeal_test.admin')::uuid;
update public.profiles set role='leader' where id=current_setting('appeal_test.leader')::uuid;
insert into public.members(strava_athlete_id,strava_name,auth_user_id,group_id,division_id,source_url,synced_at)
select x.id,'Appeal test '||x.role,current_setting('appeal_test.'||x.role)::uuid,g.id,g.division_id,'https://www.strava.com/clubs/2368312/members',now()
from (values(999999999999981::bigint,'member',false),(999999999999982,'other',true),(999999999999983,'leader',false)) x(id,role,other_division)
cross join lateral(select id,division_id from public.small_groups where division_id is not null and (not x.other_division or division_id<>(select division_id from public.small_groups where division_id is not null order by id limit 1)) order by id limit 1) g;
insert into public.club_activities(activity_id,athlete_id,athlete_name,name,sport_type,start_local,steps,source_steps,people_count,group_id,division_id,status,source,reviewed_by,reviewed_at)
select x.id,x.athlete,'Appeal test athlete','Appeal fixture','Walk','2026-10-13 12:00',1000,1000,1,case when x.status='approved' then m.group_id end,m.division_id,x.status,'{}',case when x.status='approved' then current_setting('appeal_test.admin')::uuid end,case when x.status='approved' then now()-interval '30 days' end
from (values(999999999999981::bigint,999999999999981::bigint,'approved'),(999999999999982,999999999999982,'approved'),(999999999999983,999999999999981,'pending')) x(id,athlete,status) join public.members m on m.strava_athlete_id=x.athlete;
select set_config('request.jwt.claim.sub',current_setting('appeal_test.member'),true);
set local role authenticated;
do $$ declare r jsonb; g smallint; d smallint; id bigint; begin
 select group_id,division_id into g,d from public.members where strava_athlete_id=999999999999981;
 if has_table_privilege('authenticated','public.activity_appeals','select') or has_table_privilege('authenticated','public.activity_appeals','insert') then raise exception 'Direct appeal access granted'; end if;
 begin perform public.submit_activity_appeal(999999999999982,1,2000,1::smallint,g,d,'Not my activity');raise exception 'Other member appeal accepted';exception when insufficient_privilege then null;end;
 begin perform public.submit_activity_appeal(999999999999983,1,2000,1::smallint,g,d,'Pending activity');raise exception 'Pending activity accepted';exception when raise_exception then if SQLERRM not like 'Chỉ có thể%' then raise;end if;end;
 begin perform public.submit_activity_appeal(999999999999981,0,2000,1::smallint,g,d,'Stale activity');raise exception 'Stale submission accepted';exception when raise_exception then if SQLERRM not like 'Hoạt động đã thay đổi%' then raise;end if;end;
 begin perform public.submit_activity_appeal(999999999999981,1,2000,1::smallint,g,d,' ');raise exception 'Empty reason accepted';exception when raise_exception then if SQLERRM not like 'Nhập lý do%' then raise;end if;end;
 begin perform public.submit_activity_appeal(999999999999981,1,1000,1::smallint,g,d,'No actual change');raise exception 'No-op accepted';exception when raise_exception then if SQLERRM not like 'Đề nghị phải khác%' then raise;end if;end;
 begin perform public.submit_activity_appeal(999999999999981,1,1000001,1::smallint,g,d,'Bad steps');raise exception 'Invalid range accepted';exception when raise_exception then if SQLERRM not like 'Số bước hoặc%' then raise;end if;end;
 begin perform public.submit_activity_appeal(999999999999981,1,2000,1::smallint,g,(d%5+1)::smallint,'Wrong group pair');raise exception 'Invalid group pair accepted';exception when raise_exception then if SQLERRM not like 'Nhóm đề nghị%' then raise;end if;end;
 id:=public.submit_activity_appeal(999999999999981,1,2000,1::smallint,g,d,'Correct approved steps');
 perform set_config('appeal_test.first',id::text,true);
 r:=public.get_activity_appeals(array[999999999999981,999999999999982]::bigint[]);
 if jsonb_array_length(r)<>1 or (r->0->>'can_submit')::boolean or (r->0->'activity'->>'points')::int<>1000 or (r->0->'activity'->>'revision')::int<>1 then raise exception 'Submission changed points or visibility';end if;
 if r::text like '%requested_by%' or r::text like '%reviewed_by%' or r::text like '%example.invalid%' or r::text like '%note%' then raise exception 'Appeal API leaked private fields';end if;
 begin perform public.submit_activity_appeal(999999999999981,1,3000,1::smallint,g,d,'Duplicate pending');raise exception 'Duplicate pending accepted';exception when raise_exception then if SQLERRM not like 'Hoạt động đã có%' then raise;end if;end;
 begin perform public.get_activity_appeal_page();raise exception 'Member queue allowed';exception when insufficient_privilege then null;end;
 begin perform public.get_activity_appeal_detail(id);raise exception 'Member admin detail allowed';exception when insufficient_privilege then null;end;
 begin perform public.resolve_activity_appeal(id,1,'accepted',2000,1::smallint,g,d,'Member cannot review');raise exception 'Member review allowed';exception when insufficient_privilege then null;end;
end $$;
select set_config('request.jwt.claim.sub',current_setting('appeal_test.leader'),true);
do $$ declare g smallint; d smallint; begin
 select group_id,division_id into g,d from public.members where strava_athlete_id=999999999999983;
 if jsonb_array_length(public.get_activity_appeals(array[999999999999981,999999999999982]::bigint[]))<>1 then raise exception 'Leader scope leaked another division';end if;
 begin perform public.submit_activity_appeal(999999999999982,1,2000,1::smallint,g,d,'Other division');raise exception 'Leader cross-division appeal allowed';exception when insufficient_privilege then null;end;
end $$;
select set_config('request.jwt.claim.sub',current_setting('appeal_test.admin'),true);
select public.resolve_activity_appeal(current_setting('appeal_test.first')::bigint,1,'rejected',null,null::smallint,null::smallint,null::smallint,'Existing Strava steps are correct');
select set_config('request.jwt.claim.sub',current_setting('appeal_test.leader'),true);
do $$ declare g smallint; d smallint; id bigint; begin
 select group_id,division_id into g,d from public.members where strava_athlete_id=999999999999982;
 id:=public.submit_activity_appeal(999999999999981,1,2000,3::smallint,g,d,'Leader requests correction for a member in own division');
 perform set_config('appeal_test.second',id::text,true);
end $$;
select set_config('request.jwt.claim.sub',current_setting('appeal_test.admin'),true);
do $$ declare p jsonb; g smallint; d smallint; id bigint:=current_setting('appeal_test.second')::bigint; begin
 p:=public.get_activity_appeal_detail(id);
 select group_id,division_id into g,d from public.members where strava_athlete_id=999999999999982;
 if (p->'activity'->>'revision')::int<>1 or (p->'activity'->>'points')::int<>1000 then raise exception 'Rejection altered original activity';end if;
 begin perform public.resolve_activity_appeal(id,0,'accepted',2000,3::smallint,g,d,'Stale review');raise exception 'Stale review accepted';exception when raise_exception then if SQLERRM not like 'Hoạt động đã thay đổi%' then raise;end if;end;
 begin perform public.resolve_activity_appeal(id,1,'accepted',2000,0::smallint,g,d,'Bad party');raise exception 'Bad party accepted';exception when raise_exception then if SQLERRM not like 'Số bước hoặc%' then raise;end if;end;
 begin perform public.resolve_activity_appeal(id,1,'accepted',2000,3::smallint,g,d,'');raise exception 'No admin explanation allowed';exception when raise_exception then if SQLERRM not like 'Nhập lý do xử lý%' then raise;end if;end;
 perform public.resolve_activity_appeal(id,1,'accepted',2000,3::smallint,g,d,'Matched Strava evidence and party size');
 if not exists(select 1 from public.club_activities where activity_id=999999999999981 and steps=2000 and source_steps=1000 and people_count=3 and points=2600 and revision=2 and group_id=g and division_id=d and status='approved') then raise exception 'Accepted correction or generated points wrong';end if;
 if exists(select 1 from public.members where strava_athlete_id=999999999999981 and group_id=g) then raise exception 'Appeal changed roster assignment';end if;
 if not exists(select 1 from public.audit_log where entity_id='999999999999981' and action='review_activity' and after_data->>'appeal_id'=current_setting('appeal_test.second') and after_data->>'appeal_resolution'='Matched Strava evidence and party size') then raise exception 'Correction audit missing';end if;
 begin perform public.resolve_activity_appeal(id,2,'rejected',null,null::smallint,null::smallint,null::smallint,'Second reviewer');raise exception 'Resolved appeal processed twice';exception when raise_exception then if SQLERRM not like 'Khiếu nại đã được xử lý%' then raise;end if;end;
 p:=public.get_activity_appeal_page('accepted','999999999999981',1);
 if (p->>'total')::int<>1 or (p->'counts'->>'accepted')::int<1 then raise exception 'Admin queue/search incorrect';end if;
end $$;
select set_config('request.jwt.claim.sub',current_setting('appeal_test.member'),true);
do $$ declare r jsonb; g smallint; d smallint; begin
 r:=public.get_activity_appeals(array[999999999999981]::bigint[]);
 if not (r->0->>'can_submit')::boolean or jsonb_array_length(r->0->'appeals')<>2 or r->0->'appeals'->0->>'status'<>'accepted' or r->0->'appeals'->0->'result'->>'points'<>'2600' then raise exception 'Member cannot see resolution/history or resubmit';end if;
 select group_id,division_id into g,d from public.members where strava_athlete_id=999999999999982;
 perform set_config('appeal_test.third',public.submit_activity_appeal(999999999999981,2,3000,3::smallint,g,d,'Review after previous resolution')::text,true);
end $$;
select set_config('request.jwt.claim.sub',current_setting('appeal_test.admin'),true);
-- A normal admin edit while the appeal is pending must not be overwritten by a stale decision.
select public.review_club_activity(999999999999981,2,2100,1::smallint,null::smallint,'Normal review after appeal submission','approved');
do $$ begin
 begin perform public.resolve_activity_appeal(current_setting('appeal_test.third')::bigint,2,'accepted',3000,3::smallint,1::smallint,1::smallint,'Stale form');raise exception 'Concurrent activity edit overwritten';exception when raise_exception then if SQLERRM not like 'Hoạt động đã thay đổi%' then raise;end if;end;
 perform public.resolve_activity_appeal(current_setting('appeal_test.third')::bigint,2,'rejected',null,null::smallint,null::smallint,null::smallint,'Activity already corrected separately');
 if not exists(select 1 from public.club_activities where activity_id=999999999999981 and steps=2100 and revision=3) then raise exception 'Reject changed current activity';end if;
 if has_function_privilege('anon','public.get_activity_appeals(bigint[])','execute') or has_function_privilege('authenticated','public._may_appeal(bigint)','execute') then raise exception 'Internal/anonymous access granted';end if;
end $$;
select set_config('request.jwt.claim.sub','',true);
do $$ begin
 begin perform public.get_activity_appeals(array[999999999999981]::bigint[]);raise exception 'Signed out access allowed';exception when insufficient_privilege then null;end;
end $$;
rollback;
