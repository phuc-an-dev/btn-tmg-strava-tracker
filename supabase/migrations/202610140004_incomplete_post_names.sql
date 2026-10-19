-- Use roster names when the discussion feed omits the author name.
create or replace function public.get_incomplete_posts(report_scope text default 'mine',search_text text default '',division_filter smallint default null,group_filter smallint default null)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare own_athlete bigint; result jsonb;
begin
 if auth.uid() is null or report_scope is null or report_scope not in('mine','club') or length(coalesce(search_text,''))>200 then raise exception 'Invalid request' using errcode='42501'; end if;
 select strava_athlete_id into own_athlete from public.members where auth_user_id=auth.uid() and active;
 if own_athlete is null and coalesce(public.current_app_role(),'user') not in('admin','leader') then raise exception 'Link an active member first' using errcode='42501'; end if;
 select coalesce(jsonb_agg(to_jsonb(r) order by r.posted_at desc nulls last,r.post_id desc),'[]'::jsonb) into result from (
 select p.post_id,p.athlete_id,coalesce(nullif(btrim(m.btn_name),''),nullif(btrim(p.athlete_name),''),nullif(btrim(m.strava_name),''),'') athlete_name,p.title,p.posted_at,m.division_id,m.group_id
 from public.club_incomplete_posts p left join public.members m on m.strava_athlete_id=p.athlete_id
 where not p.resolved and (report_scope='club' or p.athlete_id=own_athlete)
 and (division_filter is null or m.division_id=division_filter) and (group_filter is null or m.group_id=group_filter)
 and (coalesce(btrim(search_text),'')='' or position(lower(btrim(search_text)) in lower(p.title||' '||p.athlete_name||' '||coalesce(m.btn_name,'')||' '||coalesce(m.strava_name,'')||' '||p.post_id::text))>0)
 ) r;
 return result;
end;
$$;
revoke all on function public.get_incomplete_posts(text,text,smallint,smallint) from public;
grant execute on function public.get_incomplete_posts(text,text,smallint,smallint) to authenticated;
