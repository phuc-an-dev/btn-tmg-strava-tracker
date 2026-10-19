create table private.extension_sync_config (
 id boolean primary key default true check(id), secret_hash text not null,
 window_start timestamptz not null default now(), requests integer not null default 0
);
revoke all on private.extension_sync_config from public,anon,authenticated;
create function public.import_extension_activities(payload jsonb, sync_secret text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare cfg private.extension_sync_config; item jsonb; total integer; inserted integer:=0; affected integer;
begin
 select * into cfg from private.extension_sync_config where id=true for update;
 if not found or sync_secret is null or length(sync_secret)<32 or cfg.secret_hash<>encode(extensions.digest(sync_secret,'sha256'),'hex') then
  raise exception 'Invalid sync secret' using errcode='42501';
 end if;
 if cfg.window_start>now()-interval '1 minute' and cfg.requests>=60 then raise exception 'Rate limit' using errcode='PT429'; end if;
 update private.extension_sync_config set requests=case when window_start<=now()-interval '1 minute' then 1 else requests+1 end,
 window_start=case when window_start<=now()-interval '1 minute' then now() else window_start end where id=true;
 if payload->>'club_id' is distinct from '2368312' or jsonb_typeof(payload->'activities') is distinct from 'array' or pg_column_size(payload)>512000 then raise exception 'Invalid payload'; end if;
 total:=jsonb_array_length(payload->'activities');
 if total<1 or total>50 then raise exception 'Batch must contain 1-50 activities'; end if;
 for item in select value from jsonb_array_elements(payload->'activities') loop
  if coalesce(item->>'activity_id','')!~'^[0-9]{1,15}$' or coalesce(item->>'athlete_id','')!~'^[0-9]{1,15}$'
  or coalesce(item->>'start_local','')!~'^202[0-9]-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}$'
  or length(coalesce(item->>'name',''))>500 or length(coalesce(item->>'athlete_name',''))>200 or pg_column_size(item)>100000 then raise exception 'Invalid activity'; end if;
  insert into public.club_activities(activity_id,athlete_id,athlete_name,name,sport_type,start_local,distance_m,elapsed_seconds,source_steps,steps,division_id,people_count,source)
  values((item->>'activity_id')::bigint,(item->>'athlete_id')::bigint,coalesce(item->>'athlete_name',''),coalesce(item->>'name',''),coalesce(item->>'sport_type','Unknown'),(item->>'start_local')::timestamp,
  (item->>'distance_m')::numeric,(item->>'elapsed_seconds')::numeric,(item->>'steps')::integer,(item->>'steps')::integer,(item->>'division')::smallint,
  case when (item->>'people_count')::numeric between 1 and 100 then (item->>'people_count')::smallint else null end,item-'status'-'points'-'note'-'reviewed_by'-'reviewed_at')
  on conflict(activity_id) do nothing;
  get diagnostics affected=row_count;inserted:=inserted+affected;
 end loop;
 insert into public.audit_log(actor_id,action,entity_id,after_data) values(null,'import_activities','2368312',jsonb_build_object('source','extension','inserted',inserted,'skipped',total-inserted));
 return jsonb_build_object('inserted',inserted,'skipped',total-inserted);
end;
$$;
revoke execute on function public.import_extension_activities(jsonb,text) from public;
grant execute on function public.import_extension_activities(jsonb,text) to anon,authenticated;
