create table public.club_activities (
 activity_id bigint primary key check(activity_id>0), athlete_id bigint not null check(athlete_id>0),
 athlete_name text not null, name text not null, sport_type text not null,
 start_local timestamp not null, distance_m numeric, elapsed_seconds numeric,
 source_steps integer check(source_steps>=0), steps integer check(steps between 0 and 1000000),
 division_id smallint references public.divisions(id), people_count smallint check(people_count between 1 and 100),
 group_id smallint references public.small_groups(id),
 status text not null default 'pending' check(status in ('pending','approved','rejected')),
 note text not null default '', source jsonb not null,
 revision integer not null default 1,
 imported_by uuid references public.profiles(id), imported_at timestamptz not null default now(),
 reviewed_by uuid references public.profiles(id), reviewed_at timestamptz, updated_at timestamptz not null default now(),
 points integer generated always as (case when status='approved' then round(steps::numeric * (1 + case when people_count>1 then people_count::numeric/10 else 0 end))::integer else 0 end) stored,
 check(status<>'approved' or (steps is not null and people_count is not null and division_id is not null and group_id is not null and reviewed_by is not null and sport_type='Walk' and start_local>='2026-10-04' and start_local<'2026-11-16'))
);
create index club_activities_status_date on public.club_activities(status,start_local desc,activity_id desc);
alter table public.club_activities enable row level security;
revoke all on public.club_activities from anon,authenticated;
grant select on public.club_activities to authenticated;
create policy admin_or_approved_participant on public.club_activities for select to authenticated using (
 public.current_app_role()='admin' or (status='approved' and public.is_participant())
);

create function public.import_club_activities(payload jsonb) returns jsonb
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
  (item->>'distance_m')::numeric,(item->>'elapsed_seconds')::numeric,(item->>'steps')::integer,(item->>'steps')::integer,(item->>'division')::smallint,(item->>'people_count')::smallint,item,auth.uid())
  on conflict(activity_id) do nothing;
  get diagnostics affected=row_count;inserted:=inserted+affected;
 end loop;
 insert into public.audit_log(actor_id,action,entity_id,after_data) values(auth.uid(),'import_activities','2368312',jsonb_build_object('inserted',inserted,'skipped',total-inserted));
 return jsonb_build_object('inserted',inserted,'skipped',total-inserted);
end;
$$;

create function public.review_club_activity(target_id bigint,expected_revision integer,new_steps integer,new_people smallint,new_division smallint,new_note text,decision text) returns void
language plpgsql security definer set search_path='' as $$
declare old_row public.club_activities; new_row public.club_activities; member public.members; assigned_group smallint;
begin
 if public.current_app_role() is distinct from 'admin' then raise exception 'Admin permission required' using errcode='42501'; end if;
 if decision not in ('pending','approved','rejected') or decision is null then raise exception 'Invalid decision'; end if;
 if length(coalesce(new_note,''))>2000 then raise exception 'Note too long'; end if;
 select * into old_row from public.club_activities where activity_id=target_id for update;
 if not found then raise exception 'Activity not found'; end if;
 if old_row.revision<>expected_revision then raise exception 'Activity changed. Refresh before reviewing.'; end if;
 if decision='approved' then
  select * into member from public.members where strava_athlete_id=old_row.athlete_id and active for share;
  if not found or member.group_id is null or member.division_id is null then raise exception 'Assign this member to a small group before approving'; end if;
  if new_division is distinct from member.division_id then raise exception 'Activity division differs from member assignment'; end if;
  if old_row.sport_type<>'Walk' or old_row.start_local<'2026-10-04' or old_row.start_local>='2026-11-16' then raise exception 'Activity is outside the competition period or not Walk'; end if;
  if new_steps is null or new_people is null then raise exception 'Steps and party size are required'; end if;
  if old_row.source_steps is distinct from new_steps and nullif(btrim(new_note),'') is null then raise exception 'Explain corrected or manually supplied steps in the note'; end if;
  assigned_group:=member.group_id;
 end if;
 update public.club_activities set steps=new_steps,people_count=new_people,division_id=new_division,group_id=assigned_group,note=coalesce(new_note,''),status=decision,
 reviewed_by=case when decision='pending' then null else auth.uid() end,reviewed_at=case when decision='pending' then null else now() end,revision=revision+1,updated_at=now()
 where activity_id=target_id returning * into new_row;
 insert into public.audit_log(actor_id,action,entity_id,before_data,after_data) values(auth.uid(),'review_activity',target_id::text,to_jsonb(old_row),to_jsonb(new_row));
end;
$$;
revoke all on function public.import_club_activities(jsonb) from public,anon;
revoke all on function public.review_club_activity(bigint,integer,integer,smallint,smallint,text,text) from public,anon;
grant execute on function public.import_club_activities(jsonb) to authenticated;
grant execute on function public.review_club_activity(bigint,integer,integer,smallint,smallint,text,text) to authenticated;
