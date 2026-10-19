-- Member club view includes all statuses; internal fields remain excluded.
create or replace function public.get_member_activities(
  activity_scope text default 'mine', search_text text default '', division_filter smallint default null,
  group_filter smallint default null, status_filter text default 'all', page_number integer default 1, page_size integer default 10
) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare own_athlete bigint; result jsonb;
begin
  select strava_athlete_id into own_athlete from public.members where auth_user_id=auth.uid() and active;
  if own_athlete is null then raise exception 'Liên kết thành viên đang tham gia trước khi xem hoạt động.' using errcode='42501'; end if;
  if activity_scope not in ('mine','club') or activity_scope is null or status_filter not in ('all','pending','approved','rejected') or status_filter is null then raise exception 'Invalid filter'; end if;
  if page_number is null or page_number<1 or page_number>10000 or page_size is null or page_size<1 or page_size>50 then raise exception 'Invalid pagination'; end if;
  if length(coalesce(search_text,''))>200 then raise exception 'Search too long'; end if;
  with scoped as (
    select a.activity_id,a.athlete_id,coalesce(nullif(m.btn_name,''),a.athlete_name) as athlete_name,a.name,a.sport_type,a.start_local,
      a.steps,a.people_count,a.division_id,coalesce(a.group_id,m.group_id) as group_id,a.status,a.points,
      case when a.athlete_id=own_athlete and a.status='rejected' then coalesce(nullif(a.rejection_reason,''),'Hoạt động chưa được công nhận. Vui lòng liên hệ admin để được hướng dẫn.') else '' end as rejection_reason
    from public.club_activities a left join public.members m on m.strava_athlete_id=a.athlete_id
    where ((activity_scope='mine' and a.athlete_id=own_athlete) or activity_scope='club')
      and (division_filter is null or a.division_id=division_filter)
      and (group_filter is null or coalesce(a.group_id,m.group_id)=group_filter)
      and (coalesce(btrim(search_text),'')='' or position(lower(btrim(search_text)) in lower(a.name||' '||a.athlete_name||' '||coalesce(m.btn_name,'')||' '||a.activity_id::text))>0)
  ), visible as (select * from scoped where status_filter='all' or status=status_filter), paged as (
    select * from visible order by start_local desc,activity_id desc limit page_size offset (page_number-1)*page_size
  )
  select jsonb_build_object(
    'rows',coalesce((select jsonb_agg(to_jsonb(paged) order by start_local desc,activity_id desc) from paged),'[]'::jsonb),
    'total',(select count(*) from visible),
    'approved_points',coalesce((select sum(points) from scoped where status='approved'),0),
    'pending_points',coalesce((select sum(round(steps*(1+case when people_count>1 then people_count::numeric/10 else 0 end))) from scoped where status='pending' and steps is not null and people_count is not null and sport_type='Walk' and start_local>='2026-10-04' and start_local<'2026-11-16'),0)
  ) into result;
  return result;
end;
$$;
revoke all on function public.get_member_activities(text,text,smallint,smallint,text,integer,integer) from public,anon;
grant execute on function public.get_member_activities(text,text,smallint,smallint,text,integer,integer) to authenticated;
