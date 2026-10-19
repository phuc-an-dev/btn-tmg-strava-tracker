create type public.app_role as enum ('admin', 'leader', 'user');

create table public.divisions (
  id smallint primary key check (id between 1 and 5),
  name text not null
);
create table public.small_groups (
  id smallint primary key check (id between 1 and 10),
  name text not null,
  division_id smallint references public.divisions(id),
  unique (id, division_id)
);
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  role public.app_role not null default 'user',
  created_at timestamptz not null default now()
);
create table public.members (
  strava_athlete_id bigint primary key,
  strava_name text not null,
  btn_name text,
  strava_club_role text not null default 'Member',
  auth_user_id uuid unique references public.profiles(id) on delete set null,
  division_id smallint references public.divisions(id),
  group_id smallint,
  active boolean not null default true,
  source_url text not null,
  synced_at timestamptz not null,
  updated_at timestamptz not null default now(),
  foreign key (group_id, division_id) references public.small_groups(id, division_id),
  check (group_id is null or division_id is not null)
);
create table public.audit_log (
  id bigint generated always as identity primary key,
  actor_id uuid references public.profiles(id),
  action text not null,
  entity_id text not null,
  before_data jsonb,
  after_data jsonb,
  created_at timestamptz not null default now()
);

insert into public.divisions (id, name) select n, 'Liên đoàn ' || n from generate_series(1,5) n;
insert into public.small_groups (id, name) select n, 'Nhóm ' || n from generate_series(1,10) n;

create function public.handle_signup() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id,email) values (new.id, coalesce(new.email,''));
  return new;
end;
$$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_signup();

create function public.current_app_role() returns public.app_role language sql stable security definer set search_path = '' as $$
  select p.role from public.profiles p where p.id = auth.uid();
$$;
create function public.is_participant() returns boolean language sql stable security definer set search_path = '' as $$
  select public.current_app_role() = 'admin' or exists (
    select 1 from public.members m where m.auth_user_id=auth.uid() and m.active
  );
$$;

alter table public.divisions enable row level security;
alter table public.small_groups enable row level security;
alter table public.profiles enable row level security;
alter table public.members enable row level security;
alter table public.audit_log enable row level security;
revoke all on public.divisions, public.small_groups, public.profiles, public.members, public.audit_log from anon, authenticated;
grant select on public.divisions, public.small_groups, public.profiles, public.members, public.audit_log to authenticated;
create policy participant_divisions on public.divisions for select to authenticated using (public.is_participant());
create policy participant_groups on public.small_groups for select to authenticated using (public.is_participant());
create policy own_profile_or_admin on public.profiles for select to authenticated using (id=auth.uid() or public.current_app_role()='admin');
create policy participant_members on public.members for select to authenticated using (public.is_participant());
create policy admin_audit on public.audit_log for select to authenticated using (public.current_app_role()='admin');

create function public.assign_member(
  athlete_id bigint, member_name text, assigned_division smallint,
  assigned_group smallint, account_id uuid
) returns void language plpgsql security definer set search_path = '' as $$
declare old_row public.members; new_row public.members;
begin
  if public.current_app_role() is distinct from 'admin' then raise exception 'Admin permission required' using errcode='42501'; end if;
  if length(coalesce(member_name,'')) > 120 then raise exception 'Name too long'; end if;
  select * into old_row from public.members where strava_athlete_id=athlete_id for update;
  if not found then raise exception 'Member not found'; end if;
  if old_row.auth_user_id is not null and old_row.auth_user_id is distinct from account_id and exists (
    select 1 from public.profiles where id=old_row.auth_user_id and role='leader'
  ) then raise exception 'Change leader role to user before unlinking'; end if;
  if assigned_division is null and account_id is not null and exists (
    select 1 from public.profiles where id=account_id and role='leader'
  ) then raise exception 'A leader requires a division'; end if;
  update public.members set btn_name=nullif(btrim(member_name),''), division_id=assigned_division,
    group_id=assigned_group, auth_user_id=account_id, updated_at=now()
    where strava_athlete_id=athlete_id returning * into new_row;
  insert into public.audit_log(actor_id,action,entity_id,before_data,after_data)
    values(auth.uid(),'assign_member',athlete_id::text,to_jsonb(old_row),to_jsonb(new_row));
end;
$$;
create function public.assign_group(group_number smallint, assigned_division smallint) returns void
language plpgsql security definer set search_path = '' as $$
declare old_row public.small_groups;
begin
  if public.current_app_role() is distinct from 'admin' then raise exception 'Admin permission required' using errcode='42501'; end if;
  select * into old_row from public.small_groups where id=group_number for update;
  if not found then raise exception 'Group not found'; end if;
  if exists(select 1 from public.members where group_id=group_number) then raise exception 'Remove member assignments before moving this group'; end if;
  update public.small_groups set division_id=assigned_division where id=group_number;
  insert into public.audit_log(actor_id,action,entity_id,before_data,after_data)
    values(auth.uid(),'assign_group',group_number::text,to_jsonb(old_row),jsonb_build_object('division_id',assigned_division));
end;
$$;
create function public.set_account_role(account_id uuid, new_role public.app_role) returns void
language plpgsql security definer set search_path = '' as $$
declare old_role public.app_role;
begin
  perform pg_advisory_xact_lock(2368312);
  if public.current_app_role() is distinct from 'admin' then raise exception 'Admin permission required' using errcode='42501'; end if;
  select role into old_role from public.profiles where id=account_id for update;
  if not found then raise exception 'Account not found'; end if;
  if new_role='leader' and not exists(select 1 from public.members where auth_user_id=account_id and active and division_id is not null) then raise exception 'Assign this account to a member and division first'; end if;
  if old_role='admin' and new_role<>'admin' and (select count(*) from public.profiles where role='admin') <= 1 then raise exception 'Cannot remove the last admin'; end if;
  update public.profiles set role=new_role where id=account_id;
  insert into public.audit_log(actor_id,action,entity_id,before_data,after_data)
    values(auth.uid(),'set_account_role',account_id::text,jsonb_build_object('role',old_role),jsonb_build_object('role',new_role));
end;
$$;
revoke execute on function public.handle_signup() from public, anon, authenticated;
revoke execute on function public.current_app_role(), public.is_participant(), public.assign_member(bigint,text,smallint,smallint,uuid), public.assign_group(smallint,smallint), public.set_account_role(uuid,public.app_role) from public, anon;
grant execute on function public.current_app_role(), public.is_participant(), public.assign_member(bigint,text,smallint,smallint,uuid), public.assign_group(smallint,smallint), public.set_account_role(uuid,public.app_role) to authenticated;
