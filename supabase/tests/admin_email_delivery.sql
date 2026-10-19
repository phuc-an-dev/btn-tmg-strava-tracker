begin isolation level repeatable read;
-- Everything, including queued network wake-ups, rolls back. No real mail is sent.
do $$begin
 perform set_config('email_test.token',encode(extensions.gen_random_bytes(32),'hex'),true);
 perform set_config('email_test.admin',gen_random_uuid()::text,true);
 perform set_config('email_test.admin2',gen_random_uuid()::text,true);
 perform set_config('email_test.user',gen_random_uuid()::text,true);
 perform set_config('email_test.user2',gen_random_uuid()::text,true);
end$$;
update private.admin_email_settings set enabled=true,worker_secret_hash=encode(extensions.digest(current_setting('email_test.token'),'sha256'),'hex');
insert into auth.users(id,email,raw_user_meta_data)
select current_setting('email_test.'||role)::uuid,'email-test-'||current_setting('email_test.'||role)||'@example.invalid',jsonb_build_object('full_name','Email test '||role)
from unnest(array['admin','admin2','user','user2']) role;
update public.profiles set role='admin' where id in(current_setting('email_test.admin')::uuid,current_setting('email_test.admin2')::uuid);
update auth.users set email_confirmed_at=now() where id in(current_setting('email_test.admin')::uuid,current_setting('email_test.admin2')::uuid);
update auth.users set email_confirmed_at=now() where id in(current_setting('email_test.user')::uuid,current_setting('email_test.user2')::uuid);
do $$begin
 perform set_config('email_test.notification',(select id::text from public.admin_notifications where kind='registration' and target_id=current_setting('email_test.user')),true);
 perform set_config('email_test.job',(select id::text from public.admin_email_deliveries where notification_id=current_setting('email_test.notification')::bigint and admin_id=current_setting('email_test.admin')::uuid and stage='initial'),true);
 assert current_setting('email_test.job') is not null,'Verified signup must enqueue an email per admin';
 assert (select count(*) from public.admin_email_deliveries where notification_id=current_setting('email_test.notification')::bigint and admin_id=current_setting('email_test.admin2')::uuid)=1,'Second admin recipient missing';
 perform private.enqueue_admin_emails();
 assert (select count(*) from public.admin_email_deliveries where notification_id=current_setting('email_test.notification')::bigint and admin_id=current_setting('email_test.admin')::uuid and stage='initial')=1,'Duplicate enqueue';
 if exists(select 1 from vault.secrets where name='admin_email_worker_secret') then
  assert exists(select 1 from net.http_request_queue where headers->>'Authorization' ~ '^Bearer v1\.[0-9]{10}\.[a-f0-9]{64}$'),'Worker wake-up must use an expiring signature';
  assert not exists(select 1 from net.http_request_queue q cross join vault.decrypted_secrets v where v.name='admin_email_worker_secret' and q.headers->>'Authorization'='Bearer '||v.decrypted_secret),'Reusable credential leaked into pg_net';
 end if;
end$$;
update public.admin_email_deliveries set next_attempt_at=now()+interval '1 day';
update public.admin_email_deliveries set next_attempt_at=now()-interval '1 minute' where id=current_setting('email_test.job')::uuid;
set local role anon;
do $$declare result jsonb;begin
 begin perform public.claim_admin_email_deliveries('wrong-secret');raise exception 'Worker bypass';exception when insufficient_privilege then null;end;
 begin perform 1 from public.admin_email_deliveries;raise exception 'Direct queue read';exception when insufficient_privilege then null;end;
 begin perform public.get_admin_email_health();raise exception 'Anonymous health read';exception when insufficient_privilege then null;end;
 result=public.claim_admin_email_deliveries(current_setting('email_test.token'));
 assert jsonb_array_length(result)=1,'Expected one due delivery';
 perform set_config('email_test.lease',result->0->>'lease_id',true);
 assert public.claim_admin_email_deliveries(current_setting('email_test.token'))='[]'::jsonb,'Active lease reclaimed';
end$$;
reset role;
do $$declare proposed jsonb;begin
 select jsonb_build_object('from','REVIVE <notifications@example.invalid>','to',jsonb_build_array(recipient_email),'subject','Email test','html','<p>Fixture body</p>','text','Fixture body') into proposed
 from public.admin_email_deliveries where id=current_setting('email_test.job')::uuid;
 perform set_config('email_test.payload',proposed::text,true);
end$$;
set local role anon;
do $$declare frozen jsonb;begin
 frozen=public.prepare_admin_email_delivery(current_setting('email_test.token'),current_setting('email_test.job')::uuid,current_setting('email_test.lease')::uuid,current_setting('email_test.payload')::jsonb);
 assert frozen=current_setting('email_test.payload')::jsonb,'Payload was not frozen';
 assert public.prepare_admin_email_delivery(current_setting('email_test.token'),current_setting('email_test.job')::uuid,current_setting('email_test.lease')::uuid,jsonb_set(frozen,'{subject}','"Different subject"'))=frozen,'Retries changed the provider payload';
 perform public.finish_admin_email_delivery(current_setting('email_test.token'),current_setting('email_test.job')::uuid,current_setting('email_test.lease')::uuid,error_code=>'network_error');
end$$;
reset role;
do $$begin
 assert exists(select 1 from public.admin_email_deliveries where id=current_setting('email_test.job')::uuid and status='pending' and next_attempt_at>now() and attempts=1 and payload is not null),'Retry was not persisted';
end$$;
update public.admin_email_deliveries set next_attempt_at=now()-interval '1 minute' where id=current_setting('email_test.job')::uuid;
set local role anon;
do $$declare result jsonb;begin
 result=public.claim_admin_email_deliveries(current_setting('email_test.token'));
 assert jsonb_array_length(result)=1,'Retry claim missing';
 perform set_config('email_test.old_lease',current_setting('email_test.lease'),true);
 perform set_config('email_test.lease',result->0->>'lease_id',true);
 perform public.finish_admin_email_delivery(current_setting('email_test.token'),current_setting('email_test.job')::uuid,current_setting('email_test.old_lease')::uuid,accepted_id=>'stale-worker');
 perform public.finish_admin_email_delivery(current_setting('email_test.token'),current_setting('email_test.job')::uuid,current_setting('email_test.lease')::uuid,accepted_id=>'provider-fixture');
 perform public.finish_admin_email_delivery(current_setting('email_test.token'),current_setting('email_test.job')::uuid,current_setting('email_test.lease')::uuid,accepted_id=>'provider-fixture');
 assert public.claim_admin_email_deliveries(current_setting('email_test.token'))='[]'::jsonb,'Reminder fired before 60 minutes';
end$$;
reset role;
do $$begin
 assert exists(select 1 from public.admin_email_deliveries where id=current_setting('email_test.job')::uuid and status='sent' and provider_id='provider-fixture'),'Accepted email not recorded';
 assert (select count(*) from public.admin_email_deliveries where notification_id=current_setting('email_test.notification')::bigint and admin_id=current_setting('email_test.admin')::uuid and stage='reminder' and next_attempt_at=now()+interval '60 minutes')=1,'Reminder must be scheduled once after initial acceptance';
 perform set_config('email_test.reminder',(select id::text from public.admin_email_deliveries where notification_id=current_setting('email_test.notification')::bigint and admin_id=current_setting('email_test.admin')::uuid and stage='reminder'),true);
end$$;
-- Reading the bell does not cancel the reminder; resolving the actual case does.
insert into public.admin_notification_reads(admin_id,notification_id) values(current_setting('email_test.admin')::uuid,current_setting('email_test.notification')::bigint);
update public.admin_email_deliveries set next_attempt_at=now()-interval '1 minute' where id=current_setting('email_test.reminder')::uuid;
set local role anon;
do $$declare result jsonb;begin
 result=public.claim_admin_email_deliveries(current_setting('email_test.token'));
 assert jsonb_array_length(result)=1 and result->0->>'stage'='reminder','Read receipt incorrectly canceled reminder';
 perform set_config('email_test.reminder_lease',result->0->>'lease_id',true);
end$$;
reset role;
update public.profiles set approved_at=now() where id=current_setting('email_test.user')::uuid;
set local role anon;
do $$begin
 assert public.prepare_admin_email_delivery(current_setting('email_test.token'),current_setting('email_test.reminder')::uuid,current_setting('email_test.reminder_lease')::uuid,current_setting('email_test.payload')::jsonb) is null,'Processed registration still emailed';
end$$;
reset role;
do $$begin
 assert exists(select 1 from public.admin_email_deliveries where id=current_setting('email_test.reminder')::uuid and status='canceled'),'Processed reminder not canceled';
end$$;
-- Revoking admin access cancels jobs, and ambiguous retries stop before 24h.
update public.profiles set role='user' where id=current_setting('email_test.admin2')::uuid;
update public.admin_email_deliveries set next_attempt_at=now()-interval '1 minute',first_attempt_at=now()-interval '24 hours',attempts=1
where admin_id=current_setting('email_test.admin')::uuid and stage='initial' and status='pending';
set local role anon;
do $$begin perform public.claim_admin_email_deliveries(current_setting('email_test.token'));end$$;
reset role;
do $$begin
 assert not exists(select 1 from public.admin_email_deliveries where admin_id=current_setting('email_test.admin2')::uuid and status in('pending','sending')),'Revoked admin still queued';
 assert exists(select 1 from public.admin_email_deliveries where admin_id=current_setting('email_test.admin')::uuid and status='failed' and last_error_code='retry_window_expired'),'Retry window exceeded';
end$$;
select set_config('request.jwt.claim.sub',current_setting('email_test.admin'),true);
set local role authenticated;
do $$declare health jsonb;begin
 health=public.get_admin_email_health();
 assert health->>'enabled'='true' and (health->>'failed')::int>=1,'Admin health missing failures';
 assert health::text not like '%recipient_email%' and health::text not like '%secret%','Health leaked private data';
end$$;
reset role;
rollback;
