-- Derive a member's division from the configured small group on the server.
create function public.assign_member_group(
  athlete_id bigint, member_name text, assigned_group smallint, account_id uuid
) returns void language plpgsql security definer set search_path = '' as $$
declare group_division smallint;
begin
  if public.current_app_role() is distinct from 'admin' then
    raise exception 'Admin permission required' using errcode='42501';
  end if;
  if assigned_group is not null then
    select division_id into group_division from public.small_groups
      where id=assigned_group for update;
    if not found then raise exception 'Group not found'; end if;
    if group_division is null then raise exception 'Group requires a division'; end if;
  end if;
  perform public.assign_member(athlete_id,member_name,group_division,assigned_group,account_id);
end;
$$;
revoke execute on function public.assign_member_group(bigint,text,smallint,uuid) from public, anon;
grant execute on function public.assign_member_group(bigint,text,smallint,uuid) to authenticated;
