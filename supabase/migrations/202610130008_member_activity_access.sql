alter table public.club_activities add column rejection_reason text not null default '' check (length(rejection_reason)<=1000);
-- Internal notes/source/audit stay inaccessible through the member API.
drop policy if exists admin_or_approved_participant on public.club_activities;
create policy admin_or_approved_participant on public.club_activities for select to authenticated
using (public.current_app_role() in ('admin','leader'));
drop function public.review_club_activity(bigint,integer,integer,smallint,smallint,text,text);
create function public.review_club_activity(target_id bigint,expected_revision integer,new_steps integer,new_people smallint,new_division smallint,new_note text,decision text,new_rejection_reason text default null) returns void
language plpgsql security definer set search_path='' as $$
declare old_row public.club_activities; new_row public.club_activities; member public.members; assigned_group smallint;
begin
 if public.current_app_role() is distinct from 'admin' then raise exception 'Admin permission required' using errcode='42501'; end if;
 if decision not in ('pending','approved','rejected') or decision is null then raise exception 'Invalid decision'; end if;
 if length(coalesce(new_rejection_reason,''))>1000 then raise exception 'Rejection reason too long'; end if;
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
 update public.club_activities set steps=new_steps,people_count=new_people,division_id=new_division,group_id=assigned_group,note=coalesce(new_note,''),status=decision,rejection_reason=case when decision='rejected' then coalesce(nullif(btrim(new_rejection_reason),''),nullif(old_row.rejection_reason,''),'Hoạt động chưa được công nhận. Vui lòng liên hệ admin để được hướng dẫn.') else '' end,
 reviewed_by=case when decision='pending' then null else auth.uid() end,reviewed_at=case when decision='pending' then null else now() end,revision=revision+1,updated_at=now()
 where activity_id=target_id returning * into new_row;
 insert into public.audit_log(actor_id,action,entity_id,before_data,after_data) values(auth.uid(),'review_activity',target_id::text,to_jsonb(old_row),to_jsonb(new_row));
end;
$$;

revoke all on function public.review_club_activity(bigint,integer,integer,smallint,smallint,text,text,text) from public,anon;
grant execute on function public.review_club_activity(bigint,integer,integer,smallint,smallint,text,text,text) to authenticated;

create function public.get_member_activities(
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
    where ((activity_scope='mine' and a.athlete_id=own_athlete) or (activity_scope='club' and a.status='approved'))
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
