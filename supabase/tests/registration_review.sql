begin;
-- Fixture users are transaction-local; no auth requests or mail are sent.
insert into public.members(strava_athlete_id,strava_name,source_url,synced_at,group_id,division_id)
select 900000000000061,'Review assigned','https://www.strava.com/athletes/900000000000061',now(),id,division_id from public.small_groups where division_id is not null order by id limit 1;
insert into public.members(strava_athlete_id,strava_name,source_url,synced_at)
select n,'Review fixture '||n,'https://www.strava.com/athletes/'||n,now() from unnest(array[900000000000062,900000000000063,900000000000064,900000000000065]::bigint[]) n;
insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data) values
 ('00000000-0000-0000-0000-000000000061','review-admin@example.test',now(),'{}'),
 ('00000000-0000-0000-0000-000000000067','review-legacy@example.test',now(),'{}');
update public.profiles set role='admin' where id='00000000-0000-0000-0000-000000000061';
insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data)
select ('00000000-0000-0000-0000-'||lpad(n::text,12,'0'))::uuid,'review-'||n||'@example.test',case when n<>64 then now() end,
 jsonb_build_object('full_name','Review fixture','birth_year',2000,'gender','female','requested_group_id',(select id from public.small_groups where division_id is not null order by id desc limit 1),
 'requested_strava_athlete_id',case n when 62 then 900000000000061 when 63 then 900000000000062 when 64 then 900000000000063 when 65 then 900000000000064 when 66 then 900000000000064 when 68 then 900000000000065 end)
 from unnest(array[62,63,64,65,66,68]) n;
update public.members set active=false where strava_athlete_id=900000000000065;

select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000062',true);
set local role authenticated;
do $$begin
 begin perform public.approve_registration('00000000-0000-0000-0000-000000000063');raise exception 'Non-admin approval accepted';
 exception when insufficient_privilege then null;end;
end$$;
reset role;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000061',true);
set local role authenticated;
select public.approve_registration('00000000-0000-0000-0000-000000000062');
select public.approve_registration('00000000-0000-0000-0000-000000000063');
select public.approve_registration('00000000-0000-0000-0000-000000000063');
do $$begin
 if (select count(*) from public.audit_log where action='approve_registration' and entity_id='00000000-0000-0000-0000-000000000063')<>1 then raise exception 'Repeated approval emitted extra audit';end if;
 if (select approved_by from public.profiles where id='00000000-0000-0000-0000-000000000063')<>'00000000-0000-0000-0000-000000000061'::uuid then raise exception 'Reviewer missing';end if;
 if (select group_id from public.members where strava_athlete_id=900000000000061)<>(select id from public.small_groups where division_id is not null order by id limit 1) then raise exception 'Assigned group changed';end if;
 if (select group_id from public.members where strava_athlete_id=900000000000062)<>(select requested_group_id from public.profiles where id='00000000-0000-0000-0000-000000000063') then raise exception 'Requested group missing';end if;
 begin perform public.approve_registration('00000000-0000-0000-0000-000000000064');raise exception 'Unverified approval accepted';
 exception when raise_exception then if sqlerrm='Unverified approval accepted' then raise;end if;end;
 begin perform public.approve_registration('00000000-0000-0000-0000-000000000067');raise exception 'Incomplete approval accepted';
 exception when raise_exception then if sqlerrm='Incomplete approval accepted' then raise;end if;end;
 begin perform public.approve_registration('00000000-0000-0000-0000-000000000068');raise exception 'Inactive member accepted';
 exception when raise_exception then if sqlerrm='Inactive member accepted' then raise;end if;end;
end$$;
select public.approve_registration('00000000-0000-0000-0000-000000000065');
do $$begin
 begin perform public.approve_registration('00000000-0000-0000-0000-000000000066');raise exception 'Claimed member accepted';
 exception when raise_exception then if sqlerrm='Claimed member accepted' then raise;end if;end;
 if (select approved_at from public.profiles where id='00000000-0000-0000-0000-000000000066') is not null then raise exception 'Failed approval persisted';end if;
end$$;
reset role;
update auth.users set email_confirmed_at=now() where id='00000000-0000-0000-0000-000000000064';
do $$begin
 if (select email_verified_at from public.profiles where id='00000000-0000-0000-0000-000000000064') is null then raise exception 'OTP verification not mirrored';end if;
 if has_function_privilege('anon','public.approve_registration(uuid)','execute') then raise exception 'Anonymous approval exposed';end if;
end$$;
set local role authenticated;
select public.approve_registration('00000000-0000-0000-0000-000000000064');
reset role;
rollback;
