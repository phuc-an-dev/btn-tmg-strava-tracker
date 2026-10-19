begin;
select set_config('request.jwt.claim.sub',(select id::text from public.profiles where role='admin' limit 1),true);
set local role authenticated;
select public.import_club_activities('{"club_id":"2368312","activities":[{"activity_id":"999999999999991","athlete_id":"150058042","athlete_name":"Test","name":"LD1_10","sport_type":"Walk","start_local":"2026-10-10T12:00:00","steps":6000,"people_count":10,"division":1}]}');
select public.import_club_activities('{"club_id":"2368312","activities":[{"activity_id":"999999999999991","athlete_id":"150058042","athlete_name":"Test","name":"LD1_10","sport_type":"Walk","start_local":"2026-10-10T12:00:00","steps":1,"people_count":10,"division":1}]}');
do $$begin
 if (select points<>0 or steps<>6000 or status<>'pending' from public.club_activities where activity_id=999999999999991) then raise exception 'Duplicate overwrote pending source or assigned points'; end if;
end$$;
select public.review_club_activity(999999999999991,1,6000,10::smallint,1::smallint,'Verified','approved');
do $$begin
 if (select points<>12000 from public.club_activities where activity_id=999999999999991) then raise exception 'Wrong bonus points'; end if;
 begin
  perform public.review_club_activity(999999999999991,1,6000,10::smallint,1::smallint,'','approved');
  raise exception 'Stale revision accepted';
 exception when raise_exception then if SQLERRM not like 'Activity changed%' then raise; end if;
 end;
 begin
  perform public.review_club_activity(999999999999991,2,7000,10::smallint,1::smallint,'','approved');
  raise exception 'Manual steps accepted without note';
 exception when raise_exception then if SQLERRM not like 'Explain corrected%' then raise; end if;
 end;
end$$;
select public.review_club_activity(999999999999991,2,6000,10::smallint,1::smallint,'','pending');
do $$begin
 if (select points<>0 from public.club_activities where activity_id=999999999999991) then raise exception 'Pending kept credited points'; end if;
 if has_table_privilege('authenticated','public.club_activities','INSERT') then raise exception 'Direct writes granted'; end if;
 if has_function_privilege('anon','public.import_club_activities(jsonb)','EXECUTE') then raise exception 'Anon can import'; end if;
end$$;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',true);
do $$begin
 if exists(select 1 from public.club_activities where activity_id=999999999999991) then raise exception 'Unlinked account can read pending'; end if;
 begin
  perform public.import_club_activities('{"club_id":"2368312","activities":[]}');
  raise exception 'Non-admin can import';
 exception when insufficient_privilege then null;
 end;
 begin
  perform public.review_club_activity(999999999999991,3,6000,10::smallint,1::smallint,'','approved');
  raise exception 'Non-admin can approve';
 exception when insufficient_privilege then null;
 end;
end$$;
rollback;
