begin isolation level repeatable read;
-- Fixtures and pg_net wake-ups roll back; no push or email leaves the database.
do $$begin
 perform set_config('push_test.token',encode(extensions.gen_random_bytes(32),'hex'),true);
 perform set_config('push_test.admin',gen_random_uuid()::text,true);
 perform set_config('push_test.admin2',gen_random_uuid()::text,true);
 perform set_config('push_test.user',gen_random_uuid()::text,true);
end$$;
update private.admin_email_settings set worker_secret_hash=encode(extensions.digest(current_setting('push_test.token'),'sha256'),'hex') where singleton;
update private.admin_push_settings set enabled=true,public_key='fixture-public-key' where singleton;
insert into auth.users(id,email,raw_user_meta_data)
select current_setting('push_test.'||role)::uuid,'push-test-'||current_setting('push_test.'||role)||'@example.invalid',jsonb_build_object('full_name','Push test '||role) from unnest(array['admin','admin2','user']) role;
update public.profiles set role='admin' where id in(current_setting('push_test.admin')::uuid,current_setting('push_test.admin2')::uuid);
update auth.users set email_confirmed_at=now() where id in(current_setting('push_test.admin')::uuid,current_setting('push_test.admin2')::uuid);
select set_config('request.jwt.claim.sub',current_setting('push_test.user'),true);
set local role authenticated;
do $$begin
 begin perform public.get_admin_push_config();raise exception 'Non-admin config access';exception when insufficient_privilege then null;end;
 begin perform public.save_admin_push_subscription('{}');raise exception 'Non-admin subscription';exception when insufficient_privilege then null;end;
 begin perform 1 from public.admin_push_subscriptions;raise exception 'Direct subscription read';exception when insufficient_privilege then null;end;
 begin perform 1 from public.admin_push_deliveries;raise exception 'Direct push queue read';exception when insufficient_privilege then null;end;
end$$;
reset role;
select set_config('request.jwt.claim.sub',current_setting('push_test.admin'),true);
set local role authenticated;
do $$declare subscription jsonb;bad text;begin
 subscription=jsonb_build_object('endpoint','https://web.push.apple.com/push-test-fixture','keys',jsonb_build_object('p256dh','B'||repeat('A',86),'auth',repeat('A',22)));
 perform set_config('push_test.subscription',subscription::text,true);
 for bad in select unnest(array['http://web.push.apple.com/x','https://127.0.0.1/x','https://web.push.apple.com.evil.test/x','https://web.push.apple.com@127.0.0.1/x','https://web.push.apple.com:8443/x']) loop
  begin perform public.save_admin_push_subscription(jsonb_set(subscription,'{endpoint}',to_jsonb(bad)));raise exception 'Unsafe endpoint accepted' using errcode='XX000';exception when raise_exception then null;end;
 end loop;
 perform public.save_admin_push_subscription(subscription);
 perform public.save_admin_push_subscription(subscription);
 assert (public.get_admin_push_device(subscription->>'endpoint')->>'registered')::boolean,'Device was not registered';
 perform public.request_admin_push_test(subscription->>'endpoint');
 begin perform public.request_admin_push_test(subscription->>'endpoint');raise exception 'Test rate limit bypass' using errcode='XX000';exception when raise_exception then null;end;
end$$;
reset role;
do $$begin
 assert (select count(*) from public.admin_push_subscriptions where admin_id=current_setting('push_test.admin')::uuid)=1,'Repeated opt-in created duplicate devices';
end$$;
select set_config('request.jwt.claim.sub',current_setting('push_test.admin2'),true);
set local role authenticated;
do $$begin
 assert not(public.get_admin_push_device('https://web.push.apple.com/push-test-fixture')->>'registered')::boolean,'Other admin can read device';
 perform public.remove_admin_push_subscription('https://web.push.apple.com/push-test-fixture');
 begin perform public.request_admin_push_test('https://web.push.apple.com/push-test-fixture');raise exception 'Other admin sent to device' using errcode='XX000';exception when raise_exception then null;end;
end$$;
reset role;
-- A verified pending account creates one event per subscribed device, not per email.
update auth.users set email_confirmed_at=now() where id=current_setting('push_test.user')::uuid;
do $$begin
 perform set_config('push_test.notification',(select id::text from public.admin_notifications where target_id=current_setting('push_test.user') and kind='registration'),true);
 perform set_config('push_test.job',(select id::text from public.admin_push_deliveries where notification_id=current_setting('push_test.notification')::bigint),true);
 assert current_setting('push_test.job') is not null,'New notification did not enqueue push';
 perform private.enqueue_admin_push();
 assert (select count(*) from public.admin_push_deliveries where notification_id=current_setting('push_test.notification')::bigint)=1,'Duplicate push enqueue';
end$$;
update public.admin_push_deliveries set next_attempt_at=now()+interval '1 day' where true;
update public.admin_push_deliveries set next_attempt_at=now()-interval '1 minute' where id=current_setting('push_test.job')::uuid;
set local role anon;
do $$declare result jsonb;begin
 begin perform public.claim_admin_push_deliveries('wrong-token');raise exception 'Worker auth bypass';exception when insufficient_privilege then null;end;
 result=public.claim_admin_push_deliveries(current_setting('push_test.token'));
 assert jsonb_array_length(result)=1,'Expected one due push';
 perform set_config('push_test.lease',result->0->>'lease_id',true);
 assert public.claim_admin_push_deliveries(current_setting('push_test.token'))='[]'::jsonb,'Active lease reclaimed';
 assert public.prepare_admin_push_delivery(current_setting('push_test.token'),current_setting('push_test.job')::uuid,current_setting('push_test.lease')::uuid),'Pending case canceled';
 perform public.finish_admin_push_delivery(current_setting('push_test.token'),current_setting('push_test.job')::uuid,current_setting('push_test.lease')::uuid,429);
end$$;
reset role;
do $$begin assert exists(select 1 from public.admin_push_deliveries where id=current_setting('push_test.job')::uuid and status='pending' and attempts=1 and next_attempt_at>now()),'Transient failure did not persist retry';end$$;
update public.admin_push_deliveries set next_attempt_at=now()-interval '1 minute' where id=current_setting('push_test.job')::uuid;
set local role anon;
do $$declare result jsonb;begin
 result=public.claim_admin_push_deliveries(current_setting('push_test.token'));
 perform public.finish_admin_push_delivery(current_setting('push_test.token'),current_setting('push_test.job')::uuid,current_setting('push_test.lease')::uuid,201);
 perform set_config('push_test.lease',result->0->>'lease_id',true);
end$$;
reset role;
do $$begin assert exists(select 1 from public.admin_push_deliveries where id=current_setting('push_test.job')::uuid and status='sending'),'Stale worker acknowledged new lease';end$$;
update public.profiles set approved_at=now() where id=current_setting('push_test.user')::uuid;
set local role anon;
do $$begin assert not public.prepare_admin_push_delivery(current_setting('push_test.token'),current_setting('push_test.job')::uuid,current_setting('push_test.lease')::uuid),'Resolved case still receives push';end$$;
reset role;
-- Test deliveries allow device verification without creating fake business cases.
update public.admin_push_deliveries set next_attempt_at=now()-interval '1 minute' where is_test;
set local role anon;
do $$declare result jsonb;begin
 result=public.claim_admin_push_deliveries(current_setting('push_test.token'));
 assert jsonb_array_length(result)=1 and (result->0->>'is_test')::boolean,'Device test missing';
 perform public.finish_admin_push_delivery(current_setting('push_test.token'),(result->0->>'id')::uuid,(result->0->>'lease_id')::uuid,410);
end$$;
reset role;
do $$begin assert not exists(select 1 from public.admin_push_subscriptions where admin_id=current_setting('push_test.admin')::uuid),'Expired device not removed';end$$;
select set_config('request.jwt.claim.sub',current_setting('push_test.admin'),true);
set local role authenticated;
do $$begin perform public.save_admin_push_subscription(current_setting('push_test.subscription')::jsonb);perform public.request_admin_push_test('https://web.push.apple.com/push-test-fixture');end$$;
reset role;
update public.profiles set role='user' where id=current_setting('push_test.admin')::uuid;
set local role anon;
do $$begin assert public.claim_admin_push_deliveries(current_setting('push_test.token'))='[]'::jsonb,'Revoked admin received push';end$$;
reset role;
do $$begin assert exists(select 1 from public.admin_push_deliveries where status='canceled' and is_test),'Revoked admin job not canceled';end$$;
-- A former admin may still remove this device when signing out.
set local role authenticated;
select public.remove_admin_push_subscription('https://web.push.apple.com/push-test-fixture');
reset role;
-- Bound per-admin device storage and keep every operation scoped to its owner.
update public.profiles set role='admin' where id=current_setting('push_test.admin')::uuid;
set local role authenticated;
do $$declare i integer;subscription jsonb;begin
 subscription=current_setting('push_test.subscription')::jsonb;
 for i in 1..10 loop perform public.save_admin_push_subscription(jsonb_set(subscription,'{endpoint}',to_jsonb('https://web.push.apple.com/push-test-device-'||i)));end loop;
 begin perform public.save_admin_push_subscription(subscription);raise exception 'Device limit bypass' using errcode='XX000';exception when raise_exception then null;end;
end$$;
reset role;
rollback;
