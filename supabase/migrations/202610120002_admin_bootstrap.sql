create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
create table private.admin_bootstrap (
  email text primary key,
  strava_athlete_id bigint not null references public.members(strava_athlete_id)
);
revoke all on private.admin_bootstrap from public, anon, authenticated;

create function private.activate_first_admin() returns trigger
language plpgsql security definer set search_path = '' as $$
declare athlete_id bigint;
begin
  if new.email_confirmed_at is null then return new; end if;
  select strava_athlete_id into athlete_id from private.admin_bootstrap where email=lower(new.email) for update;
  if not found then return new; end if;
  update public.profiles set role='admin' where id=new.id;
  update public.members set auth_user_id=new.id,updated_at=now() where strava_athlete_id=athlete_id;
  delete from private.admin_bootstrap where email=lower(new.email);
  insert into public.audit_log(actor_id,action,entity_id,after_data)
    values(new.id,'activate_first_admin',new.id::text,jsonb_build_object('role','admin','strava_athlete_id',athlete_id));
  return new;
end;
$$;
revoke execute on function private.activate_first_admin() from public, anon, authenticated;
create trigger zz_activate_first_admin after insert or update of email_confirmed_at on auth.users for each row execute function private.activate_first_admin();
