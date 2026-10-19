-- Separate outbox: push outages must never block email or approval workflows.
create table private.admin_push_settings (
 singleton boolean primary key default true check(singleton),
 enabled boolean not null default false,
 public_key text,
 worker_url text not null default 'https://btn-tmg-strava-tracker.vercel.app/api/notifications/push-worker',
 last_run_at timestamptz
);
insert into private.admin_push_settings(singleton) values(true);
revoke all on private.admin_push_settings from public,anon,authenticated;

create table public.admin_push_subscriptions (
 id uuid primary key default gen_random_uuid(),
 admin_id uuid not null references public.profiles(id) on delete cascade,
 endpoint text not null unique,
 p256dh text not null,auth_key text not null,
 created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);
create index admin_push_owner on public.admin_push_subscriptions(admin_id);
create table public.admin_push_deliveries (
 id uuid primary key default gen_random_uuid(),
 subscription_id uuid not null references public.admin_push_subscriptions(id) on delete cascade,
 notification_id bigint references public.admin_notifications(id) on delete cascade,
 is_test boolean not null default false,
 status text not null default 'pending' check(status in('pending','sending','sent','failed','canceled')),
 attempts integer not null default 0,
 next_attempt_at timestamptz not null default now(),
 locked_at timestamptz,lease_id uuid,last_error_code text,sent_at timestamptz,
 created_at timestamptz not null default now(),
 check((notification_id is null)=is_test),
 unique(subscription_id,notification_id)
);
create index admin_push_due on public.admin_push_deliveries(status,next_attempt_at);
alter table public.admin_push_subscriptions enable row level security;
alter table public.admin_push_deliveries enable row level security;
revoke all on public.admin_push_subscriptions,public.admin_push_deliveries from public,anon,authenticated;

create function public.get_admin_push_config() returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
 if public.current_app_role() is distinct from 'admin' then raise exception 'Chỉ Admin được bật thông báo.' using errcode='42501';end if;
 return (select jsonb_build_object('enabled',enabled,'public_key',public_key) from private.admin_push_settings);
end;$$;
revoke all on function public.get_admin_push_config() from public,anon;
grant execute on function public.get_admin_push_config() to authenticated;

create function private.valid_push_endpoint(endpoint text) returns boolean
language sql immutable set search_path='' as $$
 select endpoint is not null and length(endpoint) between 20 and 2048
  and endpoint ~ '^https://(web\.push\.apple\.com/|fcm\.googleapis\.com/(fcm/send/|wp/)|updates\.push\.services\.mozilla\.com/wpush/v2/)[A-Za-z0-9_~.%:/+=-]+$';
$$;
revoke all on function private.valid_push_endpoint(text) from public,anon,authenticated;

create function public.save_admin_push_subscription(subscription jsonb) returns void
language plpgsql security definer set search_path='' as $$
declare endpoint_value text:=subscription->>'endpoint';key_value text:=subscription#>>'{keys,p256dh}';auth_value text:=subscription#>>'{keys,auth}';existing public.admin_push_subscriptions;
begin
 if public.current_app_role() is distinct from 'admin' or not exists(select 1 from public.profiles where id=auth.uid() and email_verified_at is not null) then raise exception 'Chỉ Admin được bật thông báo.' using errcode='42501';end if;
 if not exists(select 1 from private.admin_push_settings where enabled and public_key is not null) then raise exception 'Thông báo đẩy chưa được cấu hình.';end if;
 if not private.valid_push_endpoint(endpoint_value) or coalesce(key_value,'') !~ '^B[A-Za-z0-9_-]{86}=?$' or coalesce(auth_value,'') !~ '^[A-Za-z0-9_-]{22}(==)?$' then raise exception 'Thiết bị nhận thông báo không hợp lệ.';end if;
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text,112));
 perform pg_advisory_xact_lock(hashtextextended(endpoint_value,113));
 select * into existing from public.admin_push_subscriptions where endpoint=endpoint_value for update;
 if existing.id is not null and existing.admin_id<>auth.uid() then delete from public.admin_push_subscriptions where id=existing.id;existing.id:=null;end if;
 if existing.id is null and (select count(*) from public.admin_push_subscriptions where admin_id=auth.uid())>=10 then raise exception 'Mỗi Admin chỉ được bật tối đa 10 thiết bị.';end if;
 insert into public.admin_push_subscriptions(admin_id,endpoint,p256dh,auth_key)
 values(auth.uid(),endpoint_value,key_value,auth_value)
 on conflict(endpoint) do update set p256dh=excluded.p256dh,auth_key=excluded.auth_key,updated_at=now();
end;$$;
revoke all on function public.save_admin_push_subscription(jsonb) from public,anon;
grant execute on function public.save_admin_push_subscription(jsonb) to authenticated;

create function public.remove_admin_push_subscription(device_endpoint text) returns void
language plpgsql security definer set search_path='' as $$
begin
 -- Allow removal after role revocation as well as before signing out.
 if auth.uid() is null then raise exception 'Authentication required' using errcode='42501';end if;
 delete from public.admin_push_subscriptions where admin_id=auth.uid() and endpoint=device_endpoint;
end;$$;
revoke all on function public.remove_admin_push_subscription(text) from public,anon;
grant execute on function public.remove_admin_push_subscription(text) to authenticated;

create function public.get_admin_push_device(device_endpoint text) returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
 if public.current_app_role() is distinct from 'admin' then raise exception 'Admin required' using errcode='42501';end if;
 return jsonb_build_object('registered',exists(select 1 from public.admin_push_subscriptions where admin_id=auth.uid() and endpoint=device_endpoint),
  'last_test',(select jsonb_build_object('status',j.status,'created_at',j.created_at,'sent_at',j.sent_at) from public.admin_push_deliveries j join public.admin_push_subscriptions s on s.id=j.subscription_id where s.admin_id=auth.uid() and s.endpoint=device_endpoint and j.is_test order by j.created_at desc limit 1));
end;$$;
revoke all on function public.get_admin_push_device(text) from public,anon;
grant execute on function public.get_admin_push_device(text) to authenticated;

create function private.enqueue_admin_push(target_notification bigint default null) returns integer
language plpgsql security definer set search_path='' as $$
declare inserted integer;
begin
 if not exists(select 1 from private.admin_push_settings where enabled) then return 0;end if;
 insert into public.admin_push_deliveries(subscription_id,notification_id)
 select s.id,n.id from public.admin_notifications n cross join public.admin_push_subscriptions s join public.profiles p on p.id=s.admin_id
 where (target_notification is null or n.id=target_notification) and n.created_at>=s.created_at
  and n.created_at>now()-interval '6 hours' and private.admin_notification_pending(n) and p.role='admin' and p.email_verified_at is not null
 on conflict(subscription_id,notification_id) do nothing;
 get diagnostics inserted=row_count;return inserted;
end;$$;
revoke all on function private.enqueue_admin_push(bigint) from public,anon,authenticated;

create function private.dispatch_admin_push_worker() returns bigint
language plpgsql security definer set search_path='' as $$
declare endpoint text;token text;stamp text;signature text;request_id bigint;
begin
 select worker_url into endpoint from private.admin_push_settings where enabled;
 if endpoint is null or not exists(select 1 from public.admin_push_deliveries where (status='pending' and next_attempt_at<=now()) or (status='sending' and locked_at<now()-interval '5 minutes')) then return null;end if;
 select decrypted_secret into token from vault.decrypted_secrets where name='admin_email_worker_secret';
 if token is null then return null;end if;
 stamp:=floor(extract(epoch from clock_timestamp()))::bigint::text;
 signature:=encode(extensions.hmac(stamp,token,'sha256'),'hex');
 select net.http_post(url:=endpoint,headers:=jsonb_build_object('Content-Type','application/json','Authorization','Bearer v1.'||stamp||'.'||signature),body:='{}'::jsonb,timeout_milliseconds:=60000) into request_id;
 return request_id;
exception when others then return null;
end;$$;
revoke all on function private.dispatch_admin_push_worker() from public,anon,authenticated;
create function private.admin_push_tick() returns bigint
language plpgsql security definer set search_path='' as $$
begin perform private.enqueue_admin_push();return private.dispatch_admin_push_worker();end;$$;
revoke all on function private.admin_push_tick() from public,anon,authenticated;
create function private.on_admin_notification_push() returns trigger
language plpgsql security definer set search_path='' as $$
begin if private.enqueue_admin_push(new.id)>0 then perform private.dispatch_admin_push_worker();end if;return new;end;$$;
revoke all on function private.on_admin_notification_push() from public,anon,authenticated;
create trigger enqueue_admin_notification_push after insert on public.admin_notifications for each row execute function private.on_admin_notification_push();

create function public.request_admin_push_test(device_endpoint text) returns void
language plpgsql security definer set search_path='' as $$
declare device uuid;
begin
 if public.current_app_role() is distinct from 'admin' then raise exception 'Admin required' using errcode='42501';end if;
 if not exists(select 1 from private.admin_push_settings where enabled) then raise exception 'Thông báo đẩy chưa bật.';end if;
 select id into device from public.admin_push_subscriptions where admin_id=auth.uid() and endpoint=device_endpoint for update;
 if device is null then raise exception 'Hãy bật thông báo trên thiết bị này trước.';end if;
 if exists(select 1 from public.admin_push_deliveries where subscription_id=device and is_test and created_at>now()-interval '1 minute') then raise exception 'Vui lòng chờ một phút trước khi gửi thử lại.';end if;
 insert into public.admin_push_deliveries(subscription_id,is_test) values(device,true);
 perform private.dispatch_admin_push_worker();
end;$$;
revoke all on function public.request_admin_push_test(text) from public,anon;
grant execute on function public.request_admin_push_test(text) to authenticated;

create function public.claim_admin_push_deliveries(worker_token text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare result jsonb;
begin
 perform private.require_admin_email_worker(worker_token);
 if not exists(select 1 from private.admin_push_settings where enabled) then return '[]'::jsonb;end if;
 update private.admin_push_settings set last_run_at=now() where singleton;
 perform private.enqueue_admin_push();
 update public.admin_push_deliveries j set status='canceled',lease_id=null,locked_at=null,last_error_code='no_longer_pending'
 where j.status in('pending','sending') and (j.status='pending' or j.locked_at<now()-interval '5 minutes') and (
  not exists(select 1 from public.admin_push_subscriptions s join public.profiles p on p.id=s.admin_id where s.id=j.subscription_id and p.role='admin' and p.email_verified_at is not null)
  or (not j.is_test and not exists(select 1 from public.admin_notifications n where n.id=j.notification_id and private.admin_notification_pending(n))));
 update public.admin_push_deliveries set status='failed',lease_id=null,locked_at=null,last_error_code='retry_window_expired'
 where status in('pending','sending') and (status='pending' or locked_at<now()-interval '5 minutes') and (attempts>=8 or created_at<now()-interval '6 hours');
 with due as(select id from public.admin_push_deliveries where (status='pending' and next_attempt_at<=now()) or (status='sending' and locked_at<now()-interval '5 minutes') order by next_attempt_at,id limit 5 for update skip locked),claimed as(
  update public.admin_push_deliveries j set status='sending',attempts=j.attempts+1,locked_at=now(),lease_id=gen_random_uuid() from due where j.id=due.id returning j.*)
 select coalesce(jsonb_agg(jsonb_build_object('id',j.id,'lease_id',j.lease_id,'subscription',jsonb_build_object('endpoint',s.endpoint,'keys',jsonb_build_object('p256dh',s.p256dh,'auth',s.auth_key)),'is_test',j.is_test,'kind',n.kind,'target_id',n.target_id,'notification_id',n.id)),'[]'::jsonb)
 into result from claimed j join public.admin_push_subscriptions s on s.id=j.subscription_id left join public.admin_notifications n on n.id=j.notification_id;
 return result;
end;$$;
revoke all on function public.claim_admin_push_deliveries(text) from public;
grant execute on function public.claim_admin_push_deliveries(text) to anon,authenticated;

create function public.prepare_admin_push_delivery(worker_token text,delivery_id uuid,delivery_lease uuid) returns boolean
language plpgsql security definer set search_path='' as $$
declare job public.admin_push_deliveries;
begin
 perform private.require_admin_email_worker(worker_token);
 select * into job from public.admin_push_deliveries where id=delivery_id and status='sending' and lease_id=delivery_lease for update;
 if not found then return false;end if;
 if not exists(select 1 from private.admin_push_settings where enabled) or not exists(select 1 from public.admin_push_subscriptions s join public.profiles p on p.id=s.admin_id where s.id=job.subscription_id and p.role='admin' and p.email_verified_at is not null)
  or (not job.is_test and not exists(select 1 from public.admin_notifications n where n.id=job.notification_id and private.admin_notification_pending(n))) then
  update public.admin_push_deliveries set status='canceled',locked_at=null,lease_id=null where id=job.id;return false;
 end if;
 return true;
end;$$;
revoke all on function public.prepare_admin_push_delivery(text,uuid,uuid) from public;
grant execute on function public.prepare_admin_push_delivery(text,uuid,uuid) to anon,authenticated;

create function public.finish_admin_push_delivery(worker_token text,delivery_id uuid,delivery_lease uuid,http_status integer) returns void
language plpgsql security definer set search_path='' as $$
declare job public.admin_push_deliveries;
begin
 perform private.require_admin_email_worker(worker_token);
 select * into job from public.admin_push_deliveries where id=delivery_id and status='sending' and lease_id=delivery_lease for update;
 if not found then return;end if;
 if http_status in(404,410) then delete from public.admin_push_subscriptions where id=job.subscription_id;return;end if;
 update public.admin_push_deliveries set status=case when http_status between 200 and 299 then 'sent' when attempts>=8 or http_status in(400,413) then 'failed' else 'pending' end,
  sent_at=case when http_status between 200 and 299 then now() else null end,last_error_code=case when http_status between 200 and 299 then null else 'http_'||coalesce(http_status,0)::text end,
  next_attempt_at=now()+make_interval(mins=>least(60,power(2,least(attempts,6))::integer)),locked_at=null,lease_id=null where id=job.id;
end;$$;
revoke all on function public.finish_admin_push_delivery(text,uuid,uuid,integer) from public;
grant execute on function public.finish_admin_push_delivery(text,uuid,uuid,integer) to anon,authenticated;
