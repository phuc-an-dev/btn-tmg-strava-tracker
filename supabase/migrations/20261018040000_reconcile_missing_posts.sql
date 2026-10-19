-- Missing posts are archived separately from resolved reports; scores and kudos are untouched.
alter table public.club_incomplete_posts add column missing_since timestamptz;
create table private.extension_post_scans (
 started_at timestamptz primary key,
 completed_at timestamptz not null,
 recorded_at timestamptz not null default now(),
 observed_count integer not null,
 hidden_post_ids bigint[] not null,
 restored_post_ids bigint[] not null
);
revoke all on private.extension_post_scans from public,anon,authenticated;

create function public.complete_extension_post_scan(payload jsonb,sync_secret text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare cfg private.extension_sync_config; started timestamptz; completed timestamptz;
 ids bigint[]; hidden_ids bigint[]; restored_ids bigint[]; previous private.extension_post_scans;
begin
 select * into cfg from private.extension_sync_config where id=true for update;
 if not found or sync_secret is null or length(sync_secret)<32 or cfg.secret_hash<>encode(extensions.digest(sync_secret,'sha256'),'hex') then raise exception 'Invalid sync secret' using errcode='42501'; end if;
 if cfg.window_start>now()-interval '1 minute' and cfg.requests>=60 then raise exception 'Rate limit' using errcode='PT429'; end if;
 update private.extension_sync_config set requests=case when window_start<=now()-interval '1 minute' then 1 else requests+1 end,window_start=case when window_start<=now()-interval '1 minute' then now() else window_start end where id=true;
 if payload->>'club_id' is distinct from '2368312' or payload->'complete' is distinct from 'true'::jsonb
 or jsonb_typeof(payload->'post_ids') is distinct from 'array' or pg_column_size(payload)>1000000 then raise exception 'Invalid complete scan'; end if;
 if jsonb_array_length(payload->'post_ids')>50000 or coalesce((payload->>'pages')::integer,0)<1 then raise exception 'Invalid scan size'; end if;
 if exists(select 1 from jsonb_array_elements(payload->'post_ids') e where jsonb_typeof(e)<>'string' or (e#>>'{}')!~'^[1-9][0-9]{0,14}$') then raise exception 'Invalid post ID'; end if;
 started=(payload->>'started_at')::timestamptz; completed=(payload->>'completed_at')::timestamptz;
 if started is null or completed is null or not isfinite(started) or not isfinite(completed) or completed<started or completed>now()+interval '5 minutes' then raise exception 'Invalid scan time'; end if;
 select coalesce(array_agg(distinct value::bigint),'{}'::bigint[]) into ids from jsonb_array_elements_text(payload->'post_ids');
 select * into previous from private.extension_post_scans where started_at=started;
 if found then return jsonb_build_object('complete',true,'already_completed',true,'hidden',cardinality(previous.hidden_post_ids),'restored',cardinality(previous.restored_post_ids)); end if;
 -- An older saved crawl must never override a newer completed scan.
 if exists(select 1 from private.extension_post_scans where started_at>started) then return jsonb_build_object('complete',true,'stale',true,'hidden',0,'restored',0); end if;
 with changed as (
  update public.club_incomplete_posts set missing_since=now()
  where not resolved and missing_since is null and updated_at<started and not(post_id=any(ids))
  returning post_id
 ) select coalesce(array_agg(post_id),'{}'::bigint[]) into hidden_ids from changed;
 with changed as (
  update public.club_incomplete_posts set missing_since=null
  where missing_since is not null and post_id=any(ids)
  returning post_id
 ) select coalesce(array_agg(post_id),'{}'::bigint[]) into restored_ids from changed;
 insert into private.extension_post_scans(started_at,completed_at,observed_count,hidden_post_ids,restored_post_ids)
 values(started,completed,cardinality(ids),hidden_ids,restored_ids);
 return jsonb_build_object('complete',true,'hidden',cardinality(hidden_ids),'restored',cardinality(restored_ids));
end;
$$;
revoke all on function public.complete_extension_post_scan(jsonb,text) from public;
grant execute on function public.complete_extension_post_scan(jsonb,text) to anon,authenticated;

create or replace function public.get_incomplete_posts(report_scope text default 'mine',search_text text default '',division_filter smallint default null,group_filter smallint default null)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare own_athlete bigint; result jsonb;
begin
 if auth.uid() is null or report_scope is null or report_scope not in('mine','club') or length(coalesce(search_text,''))>200 then raise exception 'Invalid request' using errcode='42501'; end if;
 select strava_athlete_id into own_athlete from public.members where auth_user_id=auth.uid() and active;
 if own_athlete is null and coalesce(public.current_app_role(),'user') not in('admin','leader') then raise exception 'Link an active member first' using errcode='42501'; end if;
 select coalesce(jsonb_agg(to_jsonb(r) order by r.posted_at desc nulls last,r.post_id desc),'[]'::jsonb) into result from (
 select p.post_id,p.athlete_id,coalesce(nullif(btrim(m.btn_name),''),nullif(btrim(p.athlete_name),''),nullif(btrim(m.strava_name),''),'') athlete_name,p.title,p.posted_at,m.division_id,m.group_id,coalesce(d.media,'[]'::jsonb) media
 from public.club_incomplete_posts p left join public.club_discussion_posts d on d.post_id=p.post_id and d.athlete_id=p.athlete_id left join public.members m on m.strava_athlete_id=p.athlete_id
 where not p.resolved and p.missing_since is null and (report_scope='club' or p.athlete_id=own_athlete)
 and (division_filter is null or m.division_id=division_filter) and (group_filter is null or m.group_id=group_filter)
 and (coalesce(btrim(search_text),'')='' or position(lower(btrim(search_text)) in lower(p.title||' '||p.athlete_name||' '||coalesce(m.btn_name,'')||' '||coalesce(m.strava_name,'')||' '||p.post_id::text))>0)
 ) r;
 return result;
end;
$$;
revoke all on function public.get_incomplete_posts(text,text,smallint,smallint) from public;
grant execute on function public.get_incomplete_posts(text,text,smallint,smallint) to authenticated;

create or replace function public.get_incomplete_post_page(report_scope text default 'mine',search_text text default '',division_filter smallint default null,group_filter smallint default null,page_number integer default 1,count_only boolean default false)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare own_athlete bigint; result jsonb;
begin
 if auth.uid() is null or report_scope is null or report_scope not in('mine','club') or length(coalesce(search_text,''))>200 then raise exception 'Invalid request' using errcode='42501'; end if;
 if page_number is null or page_number<1 or page_number>10000 or count_only is null then raise exception 'Invalid pagination'; end if;
 select strava_athlete_id into own_athlete from public.members where auth_user_id=auth.uid() and active;
 if own_athlete is null and coalesce(public.current_app_role(),'user') not in('admin','leader') then raise exception 'Link an active member first' using errcode='42501'; end if;
 with scoped as (
  select p.post_id,p.athlete_id,coalesce(nullif(btrim(m.btn_name),''),nullif(btrim(p.athlete_name),''),nullif(btrim(m.strava_name),''),'') athlete_name,p.title,p.posted_at,m.division_id,m.group_id
  from public.club_incomplete_posts p left join public.members m on m.strava_athlete_id=p.athlete_id
  where not p.resolved and p.missing_since is null and (report_scope='club' or p.athlete_id=own_athlete)
   and (division_filter is null or m.division_id=division_filter) and (group_filter is null or m.group_id=group_filter)
   and (coalesce(btrim(search_text),'')='' or position(lower(btrim(search_text)) in lower(p.title||' '||p.athlete_name||' '||coalesce(m.btn_name,'')||' '||coalesce(m.strava_name,'')||' '||p.post_id::text))>0)
 ), paged as (select * from scoped where not count_only order by posted_at desc nulls last,post_id desc limit 10 offset (page_number-1)*10), images as (
  select p.*,coalesce(d.media,'[]'::jsonb) media from paged p left join public.club_discussion_posts d on d.post_id=p.post_id and d.athlete_id=p.athlete_id
 ) select jsonb_build_object('rows',coalesce((select jsonb_agg(to_jsonb(i) order by posted_at desc nulls last,post_id desc) from images i),'[]'::jsonb),'total',(select count(*) from scoped)) into result;
 return result;
end;
$$;
revoke all on function public.get_incomplete_post_page(text,text,smallint,smallint,integer,boolean) from public,anon;
grant execute on function public.get_incomplete_post_page(text,text,smallint,smallint,integer,boolean) to authenticated;

