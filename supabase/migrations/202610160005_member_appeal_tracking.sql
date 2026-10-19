-- Page the owner's appealed activities before returning them; never filter only the current activity page.
create function public.get_my_appeal_activities(search_text text default '',status_filter text default 'all',page_number integer default 1)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare own_athlete bigint; result jsonb;
begin
 if auth.uid() is null then raise exception 'Sign in required' using errcode='42501'; end if;
 select strava_athlete_id into own_athlete from public.members where auth_user_id=auth.uid() and active;
 if own_athlete is null then raise exception 'Liên kết thành viên đang tham gia trước khi xem khiếu nại.' using errcode='42501'; end if;
 if status_filter is null or status_filter not in('all','pending','accepted','rejected') or page_number is null or page_number not between 1 and 10000 or length(coalesce(search_text,''))>200 then raise exception 'Invalid appeal filter'; end if;
 with scoped as (
  select a.activity_id,a.athlete_id,coalesce(nullif(m.btn_name,''),a.athlete_name) as athlete_name,a.name,a.sport_type,a.start_local,
   a.steps,a.people_count,a.division_id,coalesce(a.group_id,m.group_id) as group_id,a.status,a.points,a.media,
   case when a.status='rejected' then coalesce(nullif(a.rejection_reason,''),'Hoạt động chưa được công nhận. Vui lòng liên hệ admin để được hướng dẫn.') else '' end as rejection_reason,
   latest.status as appeal_status,latest.updated_at as appeal_updated_at
  from public.club_activities a join public.members m on m.strava_athlete_id=a.athlete_id
  join lateral(select p.status,coalesce(p.reviewed_at,p.created_at) as updated_at from public.activity_appeals p where p.activity_id=a.activity_id order by p.created_at desc,p.id desc limit 1) latest on true
  where a.athlete_id=own_athlete
   and (coalesce(btrim(search_text),'')='' or position(lower(btrim(search_text)) in lower(a.name||' '||a.athlete_name||' '||coalesce(m.btn_name,'')||' '||a.activity_id::text))>0)
 ), visible as(select * from scoped where status_filter='all' or appeal_status=status_filter),
 paged as(select * from visible order by appeal_updated_at desc,activity_id desc limit 10 offset (page_number-1)*10)
 select jsonb_build_object('rows',coalesce((select jsonb_agg(to_jsonb(paged) order by appeal_updated_at desc,activity_id desc) from paged),'[]'::jsonb),
  'total',(select count(*) from visible),'approved_points',0,'pending_points',0,
  'appeal_counts',(select jsonb_build_object('pending',count(*) filter(where appeal_status='pending'),'accepted',count(*) filter(where appeal_status='accepted'),'rejected',count(*) filter(where appeal_status='rejected')) from scoped)) into result;
 return result;
end;
$$;
revoke all on function public.get_my_appeal_activities(text,text,integer) from public,anon;
grant execute on function public.get_my_appeal_activities(text,text,integer) to authenticated;
