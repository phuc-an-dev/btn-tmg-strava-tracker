-- Preserve policy semantics while evaluating the session identity once.
alter policy own_profile_or_admin on public.profiles using (id=(select auth.uid()) or (select public.current_app_role())='admin');
alter policy read_reports on public.club_incomplete_posts using (
 (select public.current_app_role()) in ('admin','leader') or exists(select 1 from public.members m where m.auth_user_id=(select auth.uid()) and m.active)
);

create function public.get_review_activity_page(search_text text default '',status_filter text default 'pending',division_filter smallint default null,page_number integer default 1,count_only boolean default false)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
 if auth.uid() is null or coalesce(public.current_app_role(),'user') not in ('admin','leader') then raise exception 'Reviewer permission required' using errcode='42501'; end if;
 if status_filter is null or status_filter not in ('pending','approved','rejected') or page_number is null or page_number<1 or page_number>10000 or count_only is null or length(coalesce(search_text,''))>200 then raise exception 'Invalid filter'; end if;
 with scoped as (
  select a.activity_id,a.athlete_id,a.athlete_name,a.name,a.sport_type,a.start_local,a.steps,a.people_count,a.division_id,a.group_id,a.status,a.revision,a.points,a.media,
   jsonb_build_object('warnings',coalesce(a.source->'warnings','[]'::jsonb)) source
  from public.club_activities a left join public.members m on m.strava_athlete_id=a.athlete_id
  where a.sport_type='Walk' and a.start_local>='2026-10-04' and a.start_local<'2026-11-16' and a.status=status_filter
   and (division_filter is null or a.division_id=division_filter)
   and (coalesce(btrim(search_text),'')='' or position(lower(btrim(search_text)) in lower(a.name||' '||a.athlete_name||' '||a.activity_id::text||' '||coalesce(m.btn_name,'')))>0)
 ), paged as (select * from scoped where not count_only order by start_local desc,activity_id desc limit 10 offset (page_number-1)*10)
 select jsonb_build_object('rows',coalesce((select jsonb_agg(to_jsonb(p) order by start_local desc,activity_id desc) from paged p),'[]'::jsonb),
  'total',(select count(*) from scoped),
  'counts',(select jsonb_build_object('pending',count(*) filter(where status='pending'),'approved',count(*) filter(where status='approved'),'rejected',count(*) filter(where status='rejected')) from public.club_activities where sport_type='Walk' and start_local>='2026-10-04' and start_local<'2026-11-16'),
  'approved_points',(select coalesce(sum(points),0) from public.club_activities where status='approved')) into result;
 return result;
end;
$$;
revoke all on function public.get_review_activity_page(text,text,smallint,integer,boolean) from public,anon;
grant execute on function public.get_review_activity_page(text,text,smallint,integer,boolean) to authenticated;

-- Keep the old RPC compatible for older clients; new clients can request only
-- a count without joining or transferring media for an inactive tab.
create function public.get_incomplete_post_page(report_scope text default 'mine',search_text text default '',division_filter smallint default null,group_filter smallint default null,page_number integer default 1,count_only boolean default false)
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
  where not p.resolved and (report_scope='club' or p.athlete_id=own_athlete)
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

-- Support the existing activity-history query; do not index tiny lookup tables.
create index audit_log_activity_history on public.audit_log(entity_id,created_at desc) where action='review_activity';
