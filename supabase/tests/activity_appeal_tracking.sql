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

insert into public.club_activities(activity_id,athlete_id,athlete_name,name,sport_type,start_local,steps,source_steps,people_count,group_id,division_id,status,source,reviewed_by,reviewed_at)
select 999999999999800+i,999999999999981,'Tracking fixture athlete','Tracking fixture '||i,'Walk','2026-10-13 12:00',1000,1000,1,m.group_id,m.division_id,'approved','{}',current_setting('appeal_test.admin')::uuid,now()
from generate_series(1,25) i cross join public.members m where m.strava_athlete_id=999999999999981;
insert into public.activity_appeals(activity_id,requested_by,requester_name,requester_role,reason,proposed_steps,proposed_people,proposed_group,proposed_division,base_revision,before_result,status,resolution_reason,result,reviewed_at,created_at)
select a.activity_id,current_setting('appeal_test.member')::uuid,'Tracking fixture member','user','Tracking fixture reason',2000,1,a.group_id,a.division_id,1,public._appeal_values(a),
 case when a.activity_id<=999999999999811 then 'pending' when a.activity_id<=999999999999820 then 'accepted' else 'rejected' end,
 case when a.activity_id>999999999999811 then 'Tracking fixture resolution' end,
 case when a.activity_id>999999999999811 then public._appeal_values(a) end,
 case when a.activity_id>999999999999811 then now() end,now()-interval '1 day'
from public.club_activities a where a.activity_id between 999999999999801 and 999999999999825;
-- A newer pending request supersedes the older accepted request for this activity.
insert into public.activity_appeals(activity_id,requested_by,requester_name,requester_role,reason,proposed_steps,proposed_people,proposed_group,proposed_division,base_revision,before_result,created_at)
select activity_id,current_setting('appeal_test.leader')::uuid,'Tracking fixture leader','leader','Tracking fixture resubmission',3000,1,group_id,division_id,1,public._appeal_values(a),now()+interval '1 second'
from public.club_activities a where activity_id=999999999999812;
insert into public.activity_appeals(activity_id,requested_by,requester_name,requester_role,reason,proposed_steps,proposed_people,proposed_group,proposed_division,base_revision,before_result)
select activity_id,current_setting('appeal_test.other')::uuid,'Other fixture member','user','Other fixture reason',2000,1,group_id,division_id,1,public._appeal_values(a)
from public.club_activities a where activity_id=999999999999982;
select set_config('request.jwt.claim.sub',current_setting('appeal_test.member'),true);
set local role authenticated;
do $$ declare r jsonb; p2 jsonb; p3 jsonb; begin
 r:=public.get_my_appeal_activities('','all',1);
 p2:=public.get_my_appeal_activities('','all',2);p3:=public.get_my_appeal_activities('','all',3);
 if (r->>'total')::int<>25 or jsonb_array_length(r->'rows')<>10 or jsonb_array_length(p2->'rows')<>10 or jsonb_array_length(p3->'rows')<>5 then raise exception 'Tracking pagination did not include all owner activities';end if;
 if exists(select 1 from jsonb_array_elements(r->'rows') a join jsonb_array_elements(p2->'rows') b on a->>'activity_id'=b->>'activity_id') then raise exception 'Tracking pages overlap';end if;
 if r->'rows'->0->>'activity_id'<>'999999999999812' or r->'rows'->0->>'appeal_status'<>'pending' then raise exception 'Latest appeal or recent update ordering is wrong';end if;
 if (r->'appeal_counts'->>'pending')::int<>12 or (r->'appeal_counts'->>'accepted')::int<>8 or (r->'appeal_counts'->>'rejected')::int<>5 then raise exception 'Tracking counts use historical rather than latest requests';end if;
 if r::text like '%requested_by%' or r::text like '%reviewed_by%' or r::text like '%"reason"%' or r::text like '%note%' or r::text like '%email%' then raise exception 'Tracking page leaked private fields';end if;
 r:=public.get_my_appeal_activities('','pending',2);
 if (r->>'total')::int<>12 or jsonb_array_length(r->'rows')<>2 then raise exception 'Pending tracking filter applied after pagination';end if;
 r:=public.get_my_appeal_activities('','accepted',1);
 if (r->>'total')::int<>8 or exists(select 1 from jsonb_array_elements(r->'rows') x where x->>'activity_id'='999999999999812') then raise exception 'Old accepted request incorrectly matches filter';end if;
 if (public.get_my_appeal_activities('','rejected',1)->>'total')::int<>5 then raise exception 'Rejected tracking filter failed';end if;
 if (public.get_my_appeal_activities('999999999999825','all',1)->>'total')::int<>1 then raise exception 'Tracking search failed';end if;
 if (public.get_my_appeal_activities('999999999999982','all',1)->>'total')::int<>0 then raise exception 'Another member activity leaked';end if;
 begin perform public.get_my_appeal_activities('','unknown',1);raise exception 'Invalid status allowed';exception when raise_exception then if SQLERRM<>'Invalid appeal filter' then raise;end if;end;
 begin perform public.get_my_appeal_activities('','all',0);raise exception 'Invalid page allowed';exception when raise_exception then if SQLERRM<>'Invalid appeal filter' then raise;end if;end;
end $$;
select set_config('request.jwt.claim.sub',current_setting('appeal_test.other'),true);
do $$ declare r jsonb; begin
 r:=public.get_my_appeal_activities();if (r->>'total')::int<>1 or r->'rows'->0->>'activity_id'<>'999999999999982' then raise exception 'Tracking scope crossed accounts';end if;
end $$;
select set_config('request.jwt.claim.sub',current_setting('appeal_test.admin'),true);
do $$ begin
 begin perform public.get_my_appeal_activities();raise exception 'Unlinked account allowed';exception when insufficient_privilege then null;end;
 if has_function_privilege('anon','public.get_my_appeal_activities(text,text,integer)','execute') then raise exception 'Anonymous tracking allowed';end if;
end $$;
rollback;
