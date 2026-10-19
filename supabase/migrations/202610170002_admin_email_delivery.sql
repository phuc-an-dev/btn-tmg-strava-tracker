-- A durable outbox is the source of truth; pg_net is only a wake-up mechanism.
create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net;
revoke all on net.http_request_queue,net._http_response from public,anon,authenticated;
revoke all on all functions in schema net from public,anon,authenticated;

create table private.admin_email_settings (
 singleton boolean primary key default true check(singleton),
 enabled boolean not null default false,
 worker_secret_hash text,
 worker_url text not null default 'https://btn-tmg-strava-tracker.vercel.app/api/notifications/email-worker',
 last_run_at timestamptz
);
insert into private.admin_email_settings(singleton) values(true);
revoke all on private.admin_email_settings from public,anon,authenticated;

create table public.admin_email_deliveries (
 id uuid primary key default gen_random_uuid(),
 notification_id bigint not null references public.admin_notifications(id) on delete cascade,
 admin_id uuid not null references public.profiles(id) on delete cascade,
 recipient_email text not null,
 stage text not null check(stage in('initial','reminder')),
 status text not null default 'pending' check(status in('pending','sending','sent','failed','canceled')),
 attempts integer not null default 0,
 next_attempt_at timestamptz not null default now(),
 first_attempt_at timestamptz,
 locked_at timestamptz,lease_id uuid,
 payload jsonb,
 provider_id text,last_error_code text,
 sent_at timestamptz,created_at timestamptz not null default now(),
 unique(notification_id,admin_id,recipient_email,stage)
);
create index admin_email_due on public.admin_email_deliveries(status,next_attempt_at);
alter table public.admin_email_deliveries enable row level security;
revoke all on public.admin_email_deliveries from public,anon,authenticated;

create function private.admin_notification_pending(n public.admin_notifications) returns boolean
language sql stable security definer set search_path='' as $$
 select case when n.kind='registration' then exists(
  select 1 from public.profiles p where p.id::text=n.target_id and p.email_verified_at is not null
   and p.approved_at is null and p.role<>'admin' and not exists(select 1 from public.members m where m.auth_user_id=p.id)
 ) else exists(select 1 from public.activity_appeals a where a.id::text=n.target_id and a.status='pending') end;
$$;
revoke all on function private.admin_notification_pending(public.admin_notifications) from public,anon,authenticated;

create function private.require_admin_email_worker(worker_token text) returns void
language plpgsql security definer set search_path='' as $$
begin
 if worker_token is null or length(worker_token) not between 32 and 200 or not exists(
  select 1 from private.admin_email_settings where worker_secret_hash=encode(extensions.digest(worker_token,'sha256'),'hex')
 ) then raise exception 'Worker authentication required' using errcode='42501';end if;
end;
$$;
revoke all on function private.require_admin_email_worker(text) from public,anon,authenticated;

create function private.enqueue_admin_emails(target_notification bigint default null) returns integer
language plpgsql security definer set search_path='' as $$
declare inserted integer;
begin
 if not exists(select 1 from private.admin_email_settings where enabled) then return 0;end if;
 insert into public.admin_email_deliveries(notification_id,admin_id,recipient_email,stage)
 select n.id,p.id,lower(btrim(p.email)),'initial' from public.admin_notifications n cross join public.profiles p
 where (target_notification is null or n.id=target_notification) and private.admin_notification_pending(n)
  and p.role='admin' and p.email_verified_at is not null and nullif(btrim(p.email),'') is not null
 on conflict(notification_id,admin_id,recipient_email,stage) do nothing;
 get diagnostics inserted=row_count;
 return inserted;
end;
$$;
revoke all on function private.enqueue_admin_emails(bigint) from public,anon,authenticated;

create function private.dispatch_admin_email_worker() returns bigint
language plpgsql security definer set search_path='' as $$
declare endpoint text;token text;request_id bigint;
begin
 select worker_url into endpoint from private.admin_email_settings where enabled;
 if endpoint is null then return null;end if;
 -- Avoid paid function invocations when there is no due work.
 if not exists(select 1 from public.admin_email_deliveries where (status='pending' and next_attempt_at<=now()) or (status='sending' and locked_at<now()-interval '5 minutes')) then return null;end if;
 select decrypted_secret into token from vault.decrypted_secrets where name='admin_email_worker_secret';
 if token is null then return null;end if;
 select net.http_post(url:=endpoint,headers:=jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||token),body:='{}'::jsonb,timeout_milliseconds:=60000) into request_id;
 return request_id;
exception when others then
 -- A network wake-up must not roll back a registration or appeal. Cron will retry.
 return null;
end;
$$;
revoke all on function private.dispatch_admin_email_worker() from public,anon,authenticated;

create function private.admin_email_tick() returns bigint
language plpgsql security definer set search_path='' as $$
begin
 perform private.enqueue_admin_emails();
 return private.dispatch_admin_email_worker();
end;
$$;
revoke all on function private.admin_email_tick() from public,anon,authenticated;
create function private.on_admin_notification_email() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if private.enqueue_admin_emails(new.id)>0 then perform private.dispatch_admin_email_worker();end if;
 return new;
end;
$$;
revoke all on function private.on_admin_notification_email() from public,anon,authenticated;
create trigger enqueue_admin_notification_email after insert on public.admin_notifications
 for each row execute function private.on_admin_notification_email();

create function public.claim_admin_email_deliveries(worker_token text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare result jsonb;
begin
 perform private.require_admin_email_worker(worker_token);
 if not exists(select 1 from private.admin_email_settings where enabled) then return '[]'::jsonb;end if;
 update private.admin_email_settings set last_run_at=now();
 perform private.enqueue_admin_emails();
 update public.admin_email_deliveries j set status='canceled',last_error_code='no_longer_pending',lease_id=null,locked_at=null
 from public.admin_notifications n where n.id=j.notification_id and j.status in('pending','sending')
  and (j.status='pending' or j.locked_at<now()-interval '5 minutes') and (
   not private.admin_notification_pending(n) or not exists(select 1 from public.profiles p where p.id=j.admin_id and p.role='admin' and p.email_verified_at is not null and lower(btrim(p.email))=j.recipient_email)
  );
 -- Stop ambiguous retries before the provider's 24-hour idempotency window expires.
 update public.admin_email_deliveries set status='failed',last_error_code='retry_window_expired',lease_id=null,locked_at=null
 where status in('pending','sending') and (status='pending' or locked_at<now()-interval '5 minutes')
  and (attempts>=12 or first_attempt_at<now()-interval '23 hours');
 with due as (
  select id from public.admin_email_deliveries where (status='pending' and next_attempt_at<=now()) or (status='sending' and locked_at<now()-interval '5 minutes')
  order by next_attempt_at,id limit 5 for update skip locked
 ), claimed as (
  update public.admin_email_deliveries j set status='sending',attempts=j.attempts+1,first_attempt_at=coalesce(j.first_attempt_at,now()),locked_at=now(),lease_id=gen_random_uuid()
  from due where j.id=due.id returning j.*
 )
 select coalesce(jsonb_agg(jsonb_build_object('id',j.id,'lease_id',j.lease_id,'recipient_email',j.recipient_email,'stage',j.stage,'kind',n.kind,'target_id',n.target_id,'actor_name',n.actor_name,'created_at',n.created_at,'payload',j.payload)),'[]'::jsonb)
 into result from claimed j join public.admin_notifications n on n.id=j.notification_id;
 return result;
end;
$$;
revoke all on function public.claim_admin_email_deliveries(text) from public;
grant execute on function public.claim_admin_email_deliveries(text) to anon,authenticated;

create function public.prepare_admin_email_delivery(worker_token text,delivery_id uuid,delivery_lease uuid,proposed_payload jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare job public.admin_email_deliveries;n public.admin_notifications;
begin
 perform private.require_admin_email_worker(worker_token);
 select * into job from public.admin_email_deliveries where id=delivery_id and status='sending' and lease_id=delivery_lease for update;
 if not found then return null;end if;
 select * into n from public.admin_notifications where id=job.notification_id;
 if not exists(select 1 from private.admin_email_settings where enabled) or not private.admin_notification_pending(n)
  or not exists(select 1 from public.profiles where id=job.admin_id and role='admin' and email_verified_at is not null and lower(btrim(email))=job.recipient_email) then
  update public.admin_email_deliveries set status='canceled',last_error_code='no_longer_pending',lease_id=null,locked_at=null where id=job.id;
  return null;
 end if;
 if job.payload is not null then return job.payload;end if;
 if proposed_payload is null or jsonb_typeof(proposed_payload)<>'object' or proposed_payload->'to' is distinct from jsonb_build_array(job.recipient_email)
  or coalesce(length(proposed_payload->>'subject'),0) not between 1 and 200 or coalesce(length(proposed_payload->>'html'),0) not between 1 and 100000
  or coalesce(length(proposed_payload->>'from'),0) not between 1 and 200 then raise exception 'Invalid email payload';end if;
 update public.admin_email_deliveries set payload=proposed_payload where id=job.id;
 return proposed_payload;
end;
$$;
revoke all on function public.prepare_admin_email_delivery(text,uuid,uuid,jsonb) from public;
grant execute on function public.prepare_admin_email_delivery(text,uuid,uuid,jsonb) to anon,authenticated;

create function public.finish_admin_email_delivery(worker_token text,delivery_id uuid,delivery_lease uuid,accepted_id text default null,error_code text default null) returns void
language plpgsql security definer set search_path='' as $$
declare job public.admin_email_deliveries;
begin
 perform private.require_admin_email_worker(worker_token);
 select * into job from public.admin_email_deliveries where id=delivery_id and status='sending' and lease_id=delivery_lease for update;
 if not found then return;end if;
 if nullif(accepted_id,'') is not null then
  update public.admin_email_deliveries set status='sent',sent_at=now(),provider_id=left(accepted_id,120),last_error_code=null,lease_id=null,locked_at=null where id=job.id;
  if job.stage='initial' then
   insert into public.admin_email_deliveries(notification_id,admin_id,recipient_email,stage,next_attempt_at)
   select job.notification_id,job.admin_id,job.recipient_email,'reminder',now()+interval '60 minutes'
   from public.admin_notifications n where n.id=job.notification_id and private.admin_notification_pending(n)
   on conflict(notification_id,admin_id,recipient_email,stage) do nothing;
  end if;
 else
  update public.admin_email_deliveries set status=case when attempts>=12 or first_attempt_at<now()-interval '23 hours' or error_code in('invalid_idempotent_request','idempotency_conflict') then 'failed' else 'pending' end,
   next_attempt_at=now()+make_interval(mins=>least(240,power(2,least(attempts,8))::integer)),last_error_code=left(coalesce(error_code,'send_failed'),80),lease_id=null,locked_at=null where id=job.id;
 end if;
end;
$$;
revoke all on function public.finish_admin_email_delivery(text,uuid,uuid,text,text) from public;
grant execute on function public.finish_admin_email_delivery(text,uuid,uuid,text,text) to anon,authenticated;

create function public.get_admin_email_health() returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
 if public.current_app_role() is distinct from 'admin' then raise exception 'Admin permission required' using errcode='42501';end if;
 return (select jsonb_build_object('enabled',s.enabled,'last_run_at',s.last_run_at,
  'pending',(select count(*) from public.admin_email_deliveries j join public.admin_notifications n on n.id=j.notification_id where j.status in('pending','sending') and private.admin_notification_pending(n)),
  'failed',(select count(*) from public.admin_email_deliveries j join public.admin_notifications n on n.id=j.notification_id where j.status='failed' and private.admin_notification_pending(n)),
  'sent',(select count(*) from public.admin_email_deliveries where status='sent'),
  'retrying',(select count(*) from public.admin_email_deliveries j join public.admin_notifications n on n.id=j.notification_id where j.status='pending' and j.attempts>0 and private.admin_notification_pending(n))
 ) from private.admin_email_settings s);
end;
$$;
revoke all on function public.get_admin_email_health() from public,anon;
grant execute on function public.get_admin_email_health() to authenticated;
