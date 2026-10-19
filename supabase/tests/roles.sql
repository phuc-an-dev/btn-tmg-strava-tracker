begin;
-- Disposable accounts exist only inside this rolled-back transaction.
-- Run while the first-admin reservation is still pending.
insert into auth.users(id,email)
select '00000000-0000-4000-8000-000000000001'::uuid,email
from private.admin_bootstrap where strava_athlete_id=191062250;
do $$ begin
  if (select role from public.profiles where id='00000000-0000-4000-8000-000000000001') <> 'user' then raise exception 'Unverified bootstrap account received admin'; end if;
end $$;
update auth.users set email_confirmed_at=now() where id='00000000-0000-4000-8000-000000000001';
insert into auth.users(id,email,email_confirmed_at) values
('00000000-0000-4000-8000-000000000002','leader-test@example.invalid',now()),
('00000000-0000-4000-8000-000000000003','user-test@example.invalid',now()),
('00000000-0000-4000-8000-000000000004','pending-test@example.invalid',now());
update public.members set auth_user_id='00000000-0000-4000-8000-000000000002',division_id=1 where strava_athlete_id=191076594;
update public.members set auth_user_id='00000000-0000-4000-8000-000000000003',division_id=2 where strava_athlete_id=149807192;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',true);
set local role authenticated;
do $$ begin
  if public.current_app_role() <> 'admin' then raise exception 'Verified bootstrap failed'; end if;
  if (select count(*) from public.members) <> 65 then raise exception 'Admin roster incomplete'; end if;
  perform public.assign_group(1::smallint,1::smallint);
  perform public.assign_member(191076594,'Test leader',1::smallint,1::smallint,'00000000-0000-4000-8000-000000000002');
  perform public.set_account_role('00000000-0000-4000-8000-000000000002','leader');
  begin
    perform public.assign_member(149807192,'Invalid group',2::smallint,1::smallint,'00000000-0000-4000-8000-000000000003');
    raise exception 'Mismatched group assignment allowed';
  exception when foreign_key_violation then null; end;
  begin
    perform public.set_account_role('00000000-0000-4000-8000-000000000001','user');
    raise exception 'Last admin demotion allowed';
  exception when raise_exception then
    if sqlerrm <> 'Cannot remove the last admin' then raise; end if;
  end;
end $$;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000002',true);
do $$ begin
  if public.current_app_role() <> 'leader' then raise exception 'Leader role missing'; end if;
  if (select count(*) from public.members) <> 65 then raise exception 'Leader roster incomplete'; end if;
  begin
    perform public.assign_group(2::smallint,1::smallint);
    raise exception 'Leader could assign group';
  exception when insufficient_privilege then null; end;
end $$;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000003',true);
do $$ begin
  if (select count(*) from public.members) <> 65 then raise exception 'Participant roster incomplete'; end if;
  if (select count(*) from public.profiles) <> 1 then raise exception 'Other account emails visible'; end if;
  begin
    update public.profiles set role='admin' where id=auth.uid();
    raise exception 'User could update own role';
  exception when insufficient_privilege then null; end;
  begin
    perform public.set_account_role(auth.uid(),'admin');
    raise exception 'User could escalate via RPC';
  exception when insufficient_privilege then null; end;
  begin
    perform public.assign_member(149807192,'Forbidden',1::smallint,null,auth.uid());
    raise exception 'User could reassign member';
  exception when insufficient_privilege then null; end;
end $$;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000004',true);
do $$ begin
  if (select count(*) from public.members) <> 0 then raise exception 'Pending account could view roster'; end if;
end $$;
reset role;
set local role anon;
do $$ begin
  begin
    perform 1 from public.members;
    raise exception 'Anonymous roster access allowed';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
rollback;
