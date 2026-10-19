-- Hosted safeupdate requires an explicit predicate even for singleton tables.
create or replace function public.claim_admin_email_deliveries(worker_token text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare result jsonb;
begin
 perform private.require_admin_email_worker(worker_token);
 if not exists(select 1 from private.admin_email_settings where enabled) then return '[]'::jsonb;end if;
 update private.admin_email_settings set last_run_at=now() where singleton;
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

-- pg_net extension tables are owned by supabase_admin: postgres cannot revoke
-- their default grants. Never place the reusable Vault token in that queue.
create or replace function private.dispatch_admin_email_worker() returns bigint
language plpgsql security definer set search_path='' as $$
declare endpoint text;token text;request_id bigint;stamp text;signature text;
begin
 select worker_url into endpoint from private.admin_email_settings where enabled;
 if endpoint is null then return null;end if;
 -- Avoid paid function invocations when there is no due work.
 if not exists(select 1 from public.admin_email_deliveries where (status='pending' and next_attempt_at<=now()) or (status='sending' and locked_at<now()-interval '5 minutes')) then return null;end if;
 select decrypted_secret into token from vault.decrypted_secrets where name='admin_email_worker_secret';
 if token is null then return null;end if;
 stamp:=floor(extract(epoch from clock_timestamp()))::bigint::text;
 signature:=encode(extensions.hmac(stamp,token,'sha256'),'hex');
 select net.http_post(url:=endpoint,headers:=jsonb_build_object('Content-Type','application/json','Authorization','Bearer v1.'||stamp||'.'||signature),body:='{}'::jsonb,timeout_milliseconds:=60000) into request_id;
 return request_id;
exception when others then
 -- A network wake-up must not roll back a registration or appeal. Cron will retry.
 return null;
end;
$$;
