begin;
-- Test fixtures are fully rolled back; no real account links are changed.
insert into auth.users(id,email) values('00000000-0000-0000-0000-000000000071','link-test-1@example.test'),('00000000-0000-0000-0000-000000000072','link-test-2@example.test');
insert into public.members(strava_athlete_id,strava_name,active,source_url,synced_at) values(999999999999971,'Test A',true,'https://www.strava.com/clubs/2368312/members',now()),(999999999999972,'Test B',true,'https://www.strava.com/clubs/2368312/members',now());
select set_config('request.jwt.claim.sub',(select id::text from public.profiles where role='admin' limit 1),true);
set local role authenticated;
select public.link_account_member('00000000-0000-0000-0000-000000000071',999999999999971,null);
select public.link_account_member('00000000-0000-0000-0000-000000000071',999999999999972,999999999999971);
do $$ begin
 if (select auth_user_id from public.members where strava_athlete_id=999999999999971) is not null then raise exception 'Old link not cleared'; end if;
 if (select auth_user_id from public.members where strava_athlete_id=999999999999972) <> '00000000-0000-0000-0000-000000000071'::uuid then raise exception 'New link missing'; end if;
 if (select count(*) from public.audit_log where action='link_account_member' and entity_id='00000000-0000-0000-0000-000000000071')<>2 then raise exception 'Audit missing'; end if;
 begin
  perform public.link_account_member('00000000-0000-0000-0000-000000000072',999999999999972,null);
  raise exception 'Occupied member accepted';
 exception when raise_exception then
  if sqlerrm='Occupied member accepted' then raise; end if;
 end;
 begin
  perform public.link_account_member('00000000-0000-0000-0000-000000000071',999999999999971,null);
  raise exception 'Stale link accepted';
 exception when serialization_failure then null;
 end;
end $$;
reset role;
update public.profiles set role='leader' where id='00000000-0000-0000-0000-000000000071';
set local role authenticated;
do $$ begin
 begin
  perform public.link_account_member('00000000-0000-0000-0000-000000000071',999999999999971,999999999999972);
  raise exception 'Unassigned leader accepted';
 exception when raise_exception then
  if sqlerrm='Unassigned leader accepted' then raise; end if;
 end;
end $$;
reset role;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000072',true);
set local role authenticated;
do $$ begin
 begin
  perform public.link_account_member('00000000-0000-0000-0000-000000000072',999999999999971,null);
  raise exception 'Nonadmin accepted';
 exception when insufficient_privilege then null;
 end;
 if has_function_privilege('anon','public.link_account_member(uuid,bigint,bigint)','execute') then raise exception 'Anonymous access granted'; end if;
end $$;
rollback;
