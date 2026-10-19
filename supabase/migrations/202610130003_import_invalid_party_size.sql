-- Preserve malformed party sizes in source JSON while leaving the review field unknown.
create or replace function public.import_club_activities(payload jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare item jsonb; inserted integer:=0; total integer; affected integer;
begin
 if public.current_app_role() is distinct from 'admin' then raise exception 'Admin permission required' using errcode='42501'; end if;
 if payload->>'club_id' is distinct from '2368312' or jsonb_typeof(payload->'activities') is distinct from 'array' then raise exception 'Invalid club or activities'; end if;
 total:=jsonb_array_length(payload->'activities');
 if total>1000 then raise exception 'Maximum 1000 activities per import'; end if;
 for item in select value from jsonb_array_elements(payload->'activities') loop
  if coalesce(item->>'activity_id','') !~ '^[0-9]{1,15}$' or coalesce(item->>'athlete_id','') !~ '^[0-9]{1,15}$' then raise exception 'Invalid activity or athlete ID'; end if;
  if coalesce(item->>'start_local','') !~ '^202[0-9]-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}$' then raise exception 'Invalid local start date'; end if;
  if length(coalesce(item->>'name',''))>500 or length(coalesce(item->>'athlete_name',''))>200 or pg_catalog.pg_column_size(item)>100000 then raise exception 'Activity source too large'; end if;
  insert into public.club_activities(activity_id,athlete_id,athlete_name,name,sport_type,start_local,distance_m,elapsed_seconds,source_steps,steps,division_id,people_count,source,imported_by)
  values((item->>'activity_id')::bigint,(item->>'athlete_id')::bigint,coalesce(item->>'athlete_name',''),coalesce(item->>'name',''),coalesce(item->>'sport_type','Unknown'),(item->>'start_local')::timestamp,
  (item->>'distance_m')::numeric,(item->>'elapsed_seconds')::numeric,(item->>'steps')::integer,(item->>'steps')::integer,(item->>'division')::smallint,case when (item->>'people_count')::numeric between 1 and 100 then (item->>'people_count')::smallint else null end,item,auth.uid())
  on conflict(activity_id) do nothing;
  get diagnostics affected=row_count;inserted:=inserted+affected;
 end loop;
 insert into public.audit_log(actor_id,action,entity_id,after_data) values(auth.uid(),'import_activities','2368312',jsonb_build_object('inserted',inserted,'skipped',total-inserted));
 return jsonb_build_object('inserted',inserted,'skipped',total-inserted);
end;
$$;

