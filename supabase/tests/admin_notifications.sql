begin;
select set_config('notification_test.admin',gen_random_uuid()::text,true),set_config('notification_test.admin2',gen_random_uuid()::text,true),
 set_config('notification_test.user',gen_random_uuid()::text,true),set_config('notification_test.leader',gen_random_uuid()::text,true);
insert into auth.users(id,email,raw_user_meta_data)
select current_setting('notification_test.'||role)::uuid,'notification-test-'||current_setting('notification_test.'||role)||'@example.invalid',jsonb_build_object('full_name','Notification test '||role)
from unnest(array['admin','admin2','user','leader']) role;
update public.profiles set role='admin' where id in(current_setting('notification_test.admin')::uuid,current_setting('notification_test.admin2')::uuid);
update public.profiles set role='leader' where id=current_setting('notification_test.leader')::uuid;
do $$begin
 assert not exists(select 1 from public.admin_notifications where target_id=current_setting('notification_test.user')),'Unverified registrations must not notify';
end$$;
update auth.users set email_confirmed_at=now() where id=current_setting('notification_test.user')::uuid;
update auth.users set email_confirmed_at=now() where id=current_setting('notification_test.user')::uuid;
do $$begin
 assert (select count(*) from public.admin_notifications where target_id=current_setting('notification_test.user'))=1,'Email sync must notify exactly once';
end$$;
select set_config('notification_test.id',(select id::text from public.admin_notifications where target_id=current_setting('notification_test.user')),true);
insert into public.admin_notifications(kind,target_id,actor_name,created_at)
select 'registration',gen_random_uuid()::text,'Notification pagination fixture',now()-interval '1 hour' from generate_series(1,12);

select set_config('request.jwt.claim.sub',current_setting('notification_test.user'),true);
set local role authenticated;
do $$begin
 begin perform public.get_admin_notifications();raise exception 'User read allowed';exception when insufficient_privilege then null;end;
 begin perform public.mark_admin_notifications_read(array[current_setting('notification_test.id')::bigint]);raise exception 'User update allowed';exception when insufficient_privilege then null;end;
 begin perform 1 from public.admin_notifications;raise exception 'Direct read allowed';exception when insufficient_privilege then null;end;
 begin insert into public.admin_notification_reads values(auth.uid(),current_setting('notification_test.id')::bigint,now());raise exception 'Direct write allowed';exception when insufficient_privilege then null;end;
end$$;
reset role;
select set_config('request.jwt.claim.sub',current_setting('notification_test.leader'),true);
set local role authenticated;
do $$begin
 begin perform public.get_admin_notifications();raise exception 'Leader read allowed';exception when insufficient_privilege then null;end;
end$$;
reset role;
select set_config('request.jwt.claim.sub',current_setting('notification_test.admin'),true);
set local role authenticated;
do $$declare data jsonb;begin
 data=public.get_admin_notifications();
 assert jsonb_array_length(data->'rows')=10,'Full bounded first page';
 assert jsonb_array_length(public.get_admin_notifications(2)->'rows')>0,'Second page missing';
 assert not exists(select 1 from jsonb_array_elements(data->'rows') x join jsonb_array_elements(public.get_admin_notifications(2)->'rows') y on x->>'id'=y->>'id'),'Pages overlap';
 assert data::text not like '%example.invalid%' and data::text not like '%reason%' and data::text not like '%admin_id%','No private fields';
 begin perform public.get_admin_notifications(0);raise exception 'Page zero allowed';exception when raise_exception then if sqlerrm='Page zero allowed' then raise;end if;end;
 begin perform public.mark_admin_notifications_read();raise exception 'Unbounded mark allowed';exception when raise_exception then if sqlerrm='Unbounded mark allowed' then raise;end if;end;
 perform public.mark_admin_notifications_read(array[current_setting('notification_test.id')::bigint]);
 perform public.mark_admin_notifications_read(array[current_setting('notification_test.id')::bigint]);
end$$;
reset role;
do $$begin
 assert (select count(*) from public.admin_notification_reads where admin_id=current_setting('notification_test.admin')::uuid and notification_id=current_setting('notification_test.id')::bigint)=1,'Read is idempotent';
 assert not exists(select 1 from public.admin_notification_reads where admin_id=current_setting('notification_test.admin2')::uuid),'Other admin stays unread';
end$$;

-- Real appeal insertion creates one event, and its latest state is shown after resolution.
insert into public.members(strava_athlete_id,strava_name,auth_user_id,group_id,division_id,source_url,synced_at)
select 999999999999971,'Notification test athlete',current_setting('notification_test.user')::uuid,id,division_id,'https://www.strava.com/clubs/2368312/members',now()
from public.small_groups where division_id is not null order by id limit 1;
insert into public.club_activities(activity_id,athlete_id,athlete_name,name,sport_type,start_local,steps,source_steps,people_count,group_id,division_id,status,source,reviewed_by,reviewed_at)
select 999999999999971,strava_athlete_id,strava_name,'Notification fixture','Walk','2026-10-13 12:00',1000,1000,1,group_id,division_id,'approved','{}',current_setting('notification_test.admin')::uuid,now()
from public.members where strava_athlete_id=999999999999971;
insert into public.activity_appeals(activity_id,requested_by,requester_name,requester_role,reason,proposed_steps,proposed_people,proposed_group,proposed_division,base_revision,before_result,created_at)
select a.activity_id,current_setting('notification_test.user')::uuid,'Notification test user','user','Notification fixture reason',2000,1,a.group_id,a.division_id,a.revision,public._appeal_values(a),now()+interval '1 second'
from public.club_activities a where activity_id=999999999999971;
select set_config('notification_test.appeal',(select id::text from public.activity_appeals where activity_id=999999999999971),true);
do $$begin
 assert (select count(*) from public.admin_notifications where kind='appeal' and target_id=current_setting('notification_test.appeal'))=1,'Appeal event missing';
end$$;
update public.activity_appeals set status='rejected',resolution_reason='Fixture rejection',result=before_result,reviewed_at=now() where id=current_setting('notification_test.appeal')::bigint;
select set_config('request.jwt.claim.sub',current_setting('notification_test.admin'),true);
set local role authenticated;
do $$declare data jsonb;begin
 data=public.get_admin_notifications();
 assert exists(select 1 from jsonb_array_elements(data->'rows') x where x->>'target_id'=current_setting('notification_test.appeal') and x->>'status'='rejected'),'Latest appeal status missing';
 assert exists(select 1 from jsonb_array_elements(data->'rows') x where x->>'target_id'=current_setting('notification_test.user') and x->>'status'='approved'),'Registration linkage must show processed';
 perform public.mark_admin_notifications_read(up_to_id=>current_setting('notification_test.id')::bigint);
end$$;
reset role;
do $$begin
 assert not exists(select 1 from public.admin_notification_reads r join public.admin_notifications n on n.id=r.notification_id where r.admin_id=current_setting('notification_test.admin')::uuid and n.kind='appeal' and n.target_id=current_setting('notification_test.appeal')),'Mark all must respect snapshot cutoff';
end$$;
-- Target deletion keeps a safe history item and disables its deep link.
delete from public.activity_appeals where id=current_setting('notification_test.appeal')::bigint;
select set_config('request.jwt.claim.sub',current_setting('notification_test.admin'),true);
set local role authenticated;
do $$declare data jsonb;begin
 data=public.get_admin_notifications();
 assert exists(select 1 from jsonb_array_elements(data->'rows') x where x->>'target_id'=current_setting('notification_test.appeal') and x->>'status'='unavailable' and x->>'available'='false'),'Missing target handling';
end$$;
reset role;
set local role anon;
do $$begin
 begin perform public.get_admin_notifications();raise exception 'Anonymous read allowed';exception when insufficient_privilege then null;end;
end$$;
reset role;
rollback;
