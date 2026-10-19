begin;
insert into public.members(strava_athlete_id,strava_name,source_url,synced_at,group_id,division_id)
select 900000000000031,'Signup fixture assigned','https://www.strava.com/athletes/900000000000031',now(),id,division_id from public.small_groups where division_id is not null order by id limit 1;
insert into public.members(strava_athlete_id,strava_name,source_url,synced_at) values(900000000000032,'Signup fixture unassigned','https://www.strava.com/athletes/900000000000032',now());
insert into auth.users(id,email,raw_user_meta_data)
select '00000000-0000-0000-0000-000000000051','signup-assigned@example.test',jsonb_build_object('requested_group_id',id,'requested_strava_athlete_id','900000000000031','full_name','Signup fixture','role','admin') from public.small_groups where division_id is not null order by id desc limit 1;
insert into auth.users(id,email,raw_user_meta_data)
select '00000000-0000-0000-0000-000000000052','signup-unassigned@example.test',jsonb_build_object('requested_group_id',id,'requested_strava_athlete_id','900000000000032') from public.small_groups where division_id is not null order by id desc limit 1;
set local role anon;
do $$ declare data jsonb; item jsonb; begin
 data=public.get_signup_options('Signup fixture',1);
 if (data->>'total')::int<>2 or jsonb_array_length(data->'members')<>2 then raise exception 'Public roster pagination failed'; end if;
 item=data->'members'->0;
 if item ? 'auth_user_id' or item ? 'email' or item ? 'btn_name' then raise exception 'Private roster fields exposed'; end if;
 if has_table_privilege('anon','public.profiles','select') or has_table_privilege('anon','public.members','select') then raise exception 'Direct private table access granted'; end if;
 begin perform public.validate_signup_selection(null,900000000000032);raise exception 'Missing group accepted';
 exception when raise_exception then if sqlerrm='Missing group accepted' then raise;end if;end;
end $$;
reset role;
do $$ begin
 if (select requested_group_id from public.profiles where id='00000000-0000-0000-0000-000000000051') is distinct from (select group_id from public.members where strava_athlete_id=900000000000031) then raise exception 'Existing group was not preserved'; end if;
 if (select role from public.profiles where id='00000000-0000-0000-0000-000000000051')<>'user' then raise exception 'Signup role escalation'; end if;
 if exists(select 1 from public.members where strava_athlete_id in(900000000000031,900000000000032) and auth_user_id is not null) then raise exception 'Signup automatically linked an account'; end if;
 begin
  insert into auth.users(id,email,raw_user_meta_data) values('00000000-0000-0000-0000-000000000053','signup-invalid@example.test','{"requested_strava_athlete_id":"900000000000032"}');
  raise exception 'Partial signup selection accepted';
 exception when raise_exception then if sqlerrm='Partial signup selection accepted' then raise;end if;end;
end $$;
select set_config('request.jwt.claim.sub',(select id::text from public.profiles where role='admin' limit 1),true);
select public.link_account_member('00000000-0000-0000-0000-000000000051',900000000000031,null);
select public.link_account_member('00000000-0000-0000-0000-000000000052',900000000000032,null);
do $$ begin
 if (select group_id from public.members where strava_athlete_id=900000000000032) is distinct from (select requested_group_id from public.profiles where id='00000000-0000-0000-0000-000000000052') then raise exception 'Requested group not applied on admin confirmation'; end if;
 if (public.get_signup_options('Signup fixture',1)->>'total')::int<>0 then raise exception 'Linked accounts visible during signup'; end if;
 begin perform public.validate_signup_selection(1::smallint,900000000000031);raise exception 'Linked account selectable';
 exception when raise_exception then if sqlerrm='Linked account selectable' then raise;end if;end;
 if public.validate_signup_selection(1::smallint,900000000000099)->>'strava_url'<>'https://www.strava.com/athletes/900000000000099' then raise exception 'Manual link for new athlete rejected'; end if;
end $$;
rollback;
