begin;
-- All fixtures and deletion effects are rolled back, including the auth rows.
insert into auth.users(id,email) values
 ('00000000-0000-0000-0000-000000000091','delete-target@example.test'),
 ('00000000-0000-0000-0000-000000000092','delete-reader@example.test');
insert into public.members(strava_athlete_id,strava_name,auth_user_id,active,source_url,synced_at,division_id,group_id)
select 999999999999991,'Deletion fixture','00000000-0000-0000-0000-000000000091',true,'https://www.strava.com',now(),division_id,id
from public.small_groups where division_id is not null limit 1;
insert into public.audit_log(actor_id,action,entity_id) values('00000000-0000-0000-0000-000000000091','fixture','delete-fixture');
insert into public.club_activities(activity_id,athlete_id,athlete_name,name,sport_type,start_local,steps,people_count,division_id,group_id,status,source,imported_by,reviewed_by)
select 999999999999991,strava_athlete_id,strava_name,'Deletion fixture','Walk','2026-10-10',6000,10,division_id,group_id,'approved','{}','00000000-0000-0000-0000-000000000091','00000000-0000-0000-0000-000000000091'
from public.members where strava_athlete_id=999999999999991;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000092',true);
set local role authenticated;
do $$ begin
 begin
  perform public.delete_account('00000000-0000-0000-0000-000000000091','delete-target@example.test');
  raise exception 'Nonadmin deletion accepted';
 exception when insufficient_privilege then null;
 end;
 if has_function_privilege('anon','public.delete_account(uuid,text)','execute') then raise exception 'Anonymous deletion granted'; end if;
end $$;
reset role;
select set_config('request.jwt.claim.sub',(select id::text from public.profiles where role='admin' limit 1),true);
set local role authenticated;
do $$ begin
 begin
  perform public.delete_account('00000000-0000-0000-0000-000000000091','wrong@example.test');
  raise exception 'Wrong email accepted';
 exception when raise_exception then if sqlerrm='Wrong email accepted' then raise; end if; end;
 begin
  perform public.delete_account(auth.uid(),(select email from public.profiles where id=auth.uid()));
  raise exception 'Self deletion accepted';
 exception when raise_exception then if sqlerrm='Self deletion accepted' then raise; end if; end;
end $$;
select public.delete_account('00000000-0000-0000-0000-000000000091','delete-target@example.test');
reset role;
do $$ begin
 if exists(select 1 from auth.users where id='00000000-0000-0000-0000-000000000091') then raise exception 'Auth account retained'; end if;
 if exists(select 1 from public.profiles where id='00000000-0000-0000-0000-000000000091') then raise exception 'Profile retained'; end if;
 if not exists(select 1 from public.members where strava_athlete_id=999999999999991 and auth_user_id is null and group_id is not null) then raise exception 'Roster assignment lost'; end if;
 if not exists(select 1 from public.club_activities where activity_id=999999999999991 and status='approved' and points=12000 and reviewed_by is null and reviewed_by_snapshot->>'email'='delete-target@example.test' and imported_by_snapshot->>'email'='delete-target@example.test') then raise exception 'Approved results or attribution lost'; end if;
 if not exists(select 1 from public.audit_log where entity_id='delete-fixture' and actor_id is null and actor_snapshot->>'email'='delete-target@example.test') then raise exception 'Historical actor lost'; end if;
 if not exists(select 1 from public.audit_log where action='delete_account' and entity_id='00000000-0000-0000-0000-000000000091') then raise exception 'Deletion audit missing'; end if;
end $$;
-- The freed email can be used by a new auth identity, with default member role.
insert into auth.users(id,email) values('00000000-0000-0000-0000-000000000093','delete-target@example.test');
do $$ begin
 if not exists(select 1 from public.profiles where id='00000000-0000-0000-0000-000000000093' and role='user') then raise exception 'Registration did not reset role'; end if;
end $$;
rollback;
