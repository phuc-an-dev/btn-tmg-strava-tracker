-- Exercise the real RPC and audit path without retaining any changes.
begin;
select set_config('request.jwt.claim.sub',(select id::text from public.profiles where role='admin' limit 1),true);
set local role authenticated;
do $$
declare target public.members; chosen public.small_groups;
begin
  select * into target from public.members where auth_user_id is null order by strava_athlete_id limit 1;
  select * into chosen from public.small_groups where division_id is not null order by id limit 1;
  if target.strava_athlete_id is null or chosen.id is null then raise exception 'Missing test fixture'; end if;
  perform public.assign_member_group(target.strava_athlete_id,target.btn_name,chosen.id,null);
  if not exists(select 1 from public.members where strava_athlete_id=target.strava_athlete_id and group_id=chosen.id and division_id=chosen.division_id) then
    raise exception 'Division was not derived from group';
  end if;
  perform public.assign_member_group(target.strava_athlete_id,target.btn_name,null,null);
  if not exists(select 1 from public.members where strava_athlete_id=target.strava_athlete_id and group_id is null and division_id is null) then
    raise exception 'Clearing group did not clear division';
  end if;
  begin
    perform public.assign_member_group(target.strava_athlete_id,target.btn_name,99::smallint,null);
    raise exception 'Invalid group accepted';
  exception when raise_exception then
    if sqlerrm <> 'Group not found' then raise; end if;
  end;
end $$;
reset role;
-- Unconfigured groups must fail even for an admin.
do $$
declare target public.members; chosen public.small_groups;
begin
  select * into target from public.members where auth_user_id is null order by strava_athlete_id limit 1;
  select * into chosen from public.small_groups where not exists(select 1 from public.members where group_id=small_groups.id) order by id limit 1;
  if chosen.id is null then raise exception 'Missing unassigned group fixture'; end if;
  update public.small_groups set division_id=null where id=chosen.id;
  begin
    perform public.assign_member_group(target.strava_athlete_id,target.btn_name,chosen.id,null);
    raise exception 'Unconfigured group accepted';
  exception when raise_exception then
    if sqlerrm <> 'Group requires a division' then raise; end if;
  end;
end $$;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000099',true);
set local role authenticated;
do $$ begin
  begin
    perform public.assign_member_group(0,'Forbidden',null,null);
    raise exception 'Non-admin assignment accepted';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
do $$ begin
  if has_function_privilege('anon','public.assign_member_group(bigint,text,smallint,uuid)','execute') then
    raise exception 'Anonymous RPC access allowed';
  end if;
end $$;
rollback;
