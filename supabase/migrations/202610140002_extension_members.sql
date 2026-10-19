create function public.import_extension_members(payload jsonb, sync_secret text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare cfg private.extension_sync_config; item jsonb; total integer; inserted integer:=0; updated integer:=0; unchanged integer:=0; affected integer;
begin
 select * into cfg from private.extension_sync_config where id=true for update;
 if not found or sync_secret is null or length(sync_secret)<32 or cfg.secret_hash<>encode(extensions.digest(sync_secret,'sha256'),'hex') then
  raise exception 'Invalid sync secret' using errcode='42501';
 end if;
 if cfg.window_start>now()-interval '1 minute' and cfg.requests>=60 then raise exception 'Rate limit' using errcode='PT429'; end if;
 update private.extension_sync_config set requests=case when window_start<=now()-interval '1 minute' then 1 else requests+1 end,
  window_start=case when window_start<=now()-interval '1 minute' then now() else window_start end where id=true;
 if payload->>'club_id' is distinct from '2368312' or payload->>'complete' is distinct from 'true'
  or jsonb_typeof(payload->'members') is distinct from 'array' or pg_column_size(payload)>512000 then raise exception 'Invalid or incomplete payload'; end if;
 total:=jsonb_array_length(payload->'members');
 if total<1 or total>1000 or (payload->>'expected_count')!~'^[0-9]+$' or (payload->>'expected_count')::integer<>total then raise exception 'Member count mismatch'; end if;
 if (select count(distinct value->>'strava_athlete_id') from jsonb_array_elements(payload->'members'))<>total then raise exception 'Duplicate member'; end if;
 for item in select value from jsonb_array_elements(payload->'members') loop
  if coalesce(item->>'strava_athlete_id','')!~'^[0-9]{1,15}$' or length(btrim(coalesce(item->>'strava_name','')))=0
   or length(item->>'strava_name')>200 or coalesce(item->>'strava_club_role','') not in ('Owner','Admin','Member') then raise exception 'Invalid member'; end if;
  update public.members set strava_name=btrim(item->>'strava_name'),strava_club_role=item->>'strava_club_role',
   source_url='https://www.strava.com/clubs/2368312/members',synced_at=now(),updated_at=now()
   where strava_athlete_id=(item->>'strava_athlete_id')::bigint
    and (strava_name is distinct from btrim(item->>'strava_name') or strava_club_role is distinct from item->>'strava_club_role'
      or source_url is distinct from 'https://www.strava.com/clubs/2368312/members');
  get diagnostics affected=row_count;
  if affected>0 then updated:=updated+1;
  elsif exists(select 1 from public.members where strava_athlete_id=(item->>'strava_athlete_id')::bigint) then
   update public.members set synced_at=now() where strava_athlete_id=(item->>'strava_athlete_id')::bigint;
   unchanged:=unchanged+1;
  else
   insert into public.members(strava_athlete_id,strava_name,strava_club_role,source_url,synced_at)
   values((item->>'strava_athlete_id')::bigint,btrim(item->>'strava_name'),item->>'strava_club_role','https://www.strava.com/clubs/2368312/members',now());
   inserted:=inserted+1;
  end if;
 end loop;
 insert into public.audit_log(actor_id,action,entity_id,after_data)
 values(null,'sync_members','2368312',jsonb_build_object('source','extension','total',total,'inserted',inserted,'updated',updated,'unchanged',unchanged));
 return jsonb_build_object('total',total,'inserted',inserted,'updated',updated,'unchanged',unchanged);
end;
$$;
revoke execute on function public.import_extension_members(jsonb,text) from public;
grant execute on function public.import_extension_members(jsonb,text) to anon,authenticated;
