begin;
-- Fixed test secret exists only inside this rolled-back transaction.
update private.extension_sync_config set secret_hash=encode(extensions.digest(repeat('t',40),'sha256'),'hex'),requests=0,window_start=now();
set local role anon;
do $$ declare result jsonb; payload jsonb:=jsonb_build_object('club_id','2368312','activities',jsonb_build_array(jsonb_build_object('activity_id','999999999999994','athlete_id','999999999999994','athlete_name','Sync test','name','Walk','sport_type','Walk','start_local','2026-10-10T10:00:00','steps',6000,'people_count',10,'division',1,'status','approved','points',999999,'note','forged'))); begin
 begin perform public.import_extension_activities(payload,'wrong');raise exception 'Wrong key accepted';exception when insufficient_privilege then null;end;
 result:=public.import_extension_activities(payload,repeat('t',40));
 if (result->>'inserted')::integer<>1 then raise exception 'Insert failed';end if;
 result:=public.import_extension_activities(payload,repeat('t',40));
 if (result->>'skipped')::integer<>1 then raise exception 'Duplicate not skipped';end if;
 begin perform public.import_extension_activities('{"club_id":"1","activities":[]}',repeat('t',40));raise exception 'Wrong club accepted';exception when raise_exception then if sqlerrm='Wrong club accepted' then raise;end if;end;
end $$;
reset role;
do $$ begin
 if has_table_privilege('anon','private.extension_sync_config','select') then raise exception 'Private secret readable';end if;
 if not exists(select 1 from public.club_activities where activity_id=999999999999994 and status='pending' and points=0 and note='' and imported_by is null and not(source ? 'note')) then raise exception 'Forged approval accepted';end if;
 if not exists(select 1 from public.audit_log where after_data->>'source'='extension' and (after_data->>'inserted')::integer=1) then raise exception 'Missing sync audit';end if;
end $$;
update public.club_activities set status='approved',reviewed_by=(select id from public.profiles where role='admin' limit 1),group_id=g.id,division_id=g.division_id from (select id,division_id from public.small_groups where division_id is not null limit 1) g where activity_id=999999999999994;
set local role anon;
select public.import_extension_activities('{"club_id":"2368312","activities":[{"activity_id":"999999999999994","athlete_id":"999999999999994","name":"Changed","sport_type":"Walk","start_local":"2026-10-10T10:00:00","steps":1}]}',repeat('t',40));
reset role;
do $$ begin if not exists(select 1 from public.club_activities where activity_id=999999999999994 and status='approved' and steps=6000 and points=12000) then raise exception 'Approved data overwritten';end if;end $$;
update private.extension_sync_config set requests=60,window_start=now();
set local role anon;
do $$ begin
 begin perform public.import_extension_activities('{"club_id":"2368312","activities":[]}',repeat('t',40));raise exception 'Rate limit ignored';exception when sqlstate 'PT429' then null;end;
end $$;
rollback;
