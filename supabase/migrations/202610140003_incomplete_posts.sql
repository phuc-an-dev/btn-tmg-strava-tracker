-- Reports without an embedded activity have no metrics or review permissions.
create table public.club_incomplete_posts (
 post_id bigint primary key check(post_id>0), athlete_id bigint not null check(athlete_id>0),
 athlete_name text not null check(length(athlete_name)<=200), title text not null check(length(title)<=500),
 posted_at timestamptz, resolved boolean not null default false, updated_at timestamptz not null default now()
);
alter table public.club_incomplete_posts enable row level security;
revoke all on public.club_incomplete_posts from public,anon,authenticated;
grant select on public.club_incomplete_posts to authenticated;
create policy read_reports on public.club_incomplete_posts for select to authenticated using (
 public.current_app_role() in ('admin','leader') or exists(select 1 from public.members m where m.auth_user_id=auth.uid() and m.active)
);
create function public.import_extension_posts(payload jsonb,sync_secret text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare cfg private.extension_sync_config; item jsonb; ids jsonb; total integer; has_activity boolean;
begin
 select * into cfg from private.extension_sync_config where id=true for update;
 if not found or sync_secret is null or length(sync_secret)<32 or cfg.secret_hash<>encode(extensions.digest(sync_secret,'sha256'),'hex') then raise exception 'Invalid sync secret' using errcode='42501'; end if;
 if cfg.window_start>now()-interval '1 minute' and cfg.requests>=60 then raise exception 'Rate limit' using errcode='PT429'; end if;
 update private.extension_sync_config set requests=case when window_start<=now()-interval '1 minute' then 1 else requests+1 end,window_start=case when window_start<=now()-interval '1 minute' then now() else window_start end where id=true;
 if payload->>'club_id' is distinct from '2368312' or jsonb_typeof(payload->'posts') is distinct from 'array' or pg_column_size(payload)>512000 then raise exception 'Invalid payload'; end if;
 total=jsonb_array_length(payload->'posts'); if total<1 or total>50 then raise exception 'Invalid batch'; end if;
 for item in select value from jsonb_array_elements(payload->'posts') loop
  if coalesce(item->>'post_id','')!~'^[0-9]{1,15}$' or coalesce(item->>'athlete_id','')!~'^[0-9]{1,15}$' or length(coalesce(item->>'title',''))>500 or length(coalesce(item->>'athlete_name',''))>200 then raise exception 'Invalid report'; end if;
  ids=item->'activity_ids'; if jsonb_typeof(ids) is distinct from 'array' or jsonb_array_length(ids)>50 then raise exception 'Invalid activity links'; end if;
  -- A report is resolved only after a linked activity was successfully imported.
  select exists(select 1 from public.club_activities a where a.activity_id::text in(select jsonb_array_elements_text(ids)) and a.source->'source_posts' @> jsonb_build_array(jsonb_build_object('post_id',item->>'post_id'))) into has_activity;
  if jsonb_array_length(ids)>0 and not has_activity then continue; end if;
  insert into public.club_incomplete_posts(post_id,athlete_id,athlete_name,title,posted_at,resolved)
  values((item->>'post_id')::bigint,(item->>'athlete_id')::bigint,coalesce(item->>'athlete_name',''),coalesce(item->>'title',''),(item->>'posted_at')::timestamptz,has_activity)
  on conflict(post_id) do update set athlete_id=excluded.athlete_id,athlete_name=excluded.athlete_name,title=excluded.title,posted_at=excluded.posted_at,resolved=excluded.resolved,updated_at=now();
 end loop;
 return jsonb_build_object('processed',total);
end;
$$;
revoke all on function public.import_extension_posts(jsonb,text) from public;
grant execute on function public.import_extension_posts(jsonb,text) to anon,authenticated;
create function public.get_incomplete_posts(report_scope text default 'mine',search_text text default '',division_filter smallint default null,group_filter smallint default null)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare own_athlete bigint; result jsonb;
begin
 if auth.uid() is null or report_scope is null or report_scope not in('mine','club') or length(coalesce(search_text,''))>200 then raise exception 'Invalid request' using errcode='42501'; end if;
 select strava_athlete_id into own_athlete from public.members where auth_user_id=auth.uid() and active;
 if own_athlete is null and coalesce(public.current_app_role(),'user') not in('admin','leader') then raise exception 'Link an active member first' using errcode='42501'; end if;
 select coalesce(jsonb_agg(to_jsonb(r) order by r.posted_at desc nulls last,r.post_id desc),'[]'::jsonb) into result from (
 select p.post_id,p.athlete_id,coalesce(nullif(m.btn_name,''),p.athlete_name) athlete_name,p.title,p.posted_at,m.division_id,m.group_id
 from public.club_incomplete_posts p left join public.members m on m.strava_athlete_id=p.athlete_id
 where not p.resolved and (report_scope='club' or p.athlete_id=own_athlete)
 and (division_filter is null or m.division_id=division_filter) and (group_filter is null or m.group_id=group_filter)
 and (coalesce(btrim(search_text),'')='' or position(lower(btrim(search_text)) in lower(p.title||' '||p.athlete_name||' '||coalesce(m.btn_name,'')||' '||p.post_id::text))>0)
 ) r;
 return result;
end;
$$;
revoke all on function public.get_incomplete_posts(text,text,smallint,smallint) from public;
grant execute on function public.get_incomplete_posts(text,text,smallint,smallint) to authenticated;
