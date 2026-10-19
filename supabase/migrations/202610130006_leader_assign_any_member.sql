-- Migration: Allow leaders to assign any member regardless of current division
create or replace function public.assign_member(
  athlete_id bigint, member_name text, assigned_division smallint,
  assigned_group smallint, account_id uuid
) returns void language plpgsql security definer set search_path = '' as $$
declare
  caller_role public.app_role;
  old_row public.members;
  new_row public.members;
begin
  caller_role := public.current_app_role();
  if caller_role not in ('admin', 'leader') then
    raise exception 'Admin or leader permission required' using errcode='42501';
  end if;
  if length(coalesce(member_name,'')) > 120 then raise exception 'Name too long'; end if;
  select * into old_row from public.members where strava_athlete_id=athlete_id for update;
  if not found then raise exception 'Member not found'; end if;

  if caller_role = 'leader' then
    -- Leader can assign any member to correct misassignment, but cannot change account linking
    account_id := old_row.auth_user_id;
  end if;

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

create or replace function public.assign_member_group(
  athlete_id bigint, member_name text, assigned_group smallint, account_id uuid
) returns void language plpgsql security definer set search_path = '' as $$
declare
  caller_role public.app_role;
  group_division smallint;
  member_row public.members;
begin
  caller_role := public.current_app_role();
  if caller_role not in ('admin', 'leader') then
    raise exception 'Admin or leader permission required' using errcode='42501';
  end if;

  select * into member_row from public.members where strava_athlete_id=athlete_id for share;
  if not found then raise exception 'Member not found'; end if;

  if assigned_group is not null then
    select division_id into group_division from public.small_groups
      where id=assigned_group for update;
    if not found then raise exception 'Group not found'; end if;
    if group_division is null then raise exception 'Group requires a division'; end if;
  else
    group_division := null;
  end if;

  if caller_role = 'leader' then
    account_id := member_row.auth_user_id;
  end if;

  perform public.assign_member(athlete_id,member_name,group_division,assigned_group,account_id);
end;
$$;

revoke execute on function public.assign_member(bigint,text,smallint,smallint,uuid) from public, anon;
grant execute on function public.assign_member(bigint,text,smallint,smallint,uuid) to authenticated;
revoke execute on function public.assign_member_group(bigint,text,smallint,uuid) from public, anon;
grant execute on function public.assign_member_group(bigint,text,smallint,uuid) to authenticated;
