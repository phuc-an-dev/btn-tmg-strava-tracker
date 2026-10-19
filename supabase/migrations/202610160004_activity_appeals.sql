-- Appeals preserve approved scores until an admin atomically accepts a correction.
create table public.activity_appeals (
 id bigint generated always as identity primary key,
 activity_id bigint not null references public.club_activities(activity_id),
 requested_by uuid references public.profiles(id) on delete set null,
 requester_name text not null, requester_role text not null,
 reason text not null check(length(btrim(reason)) between 1 and 2000),
 proposed_steps integer not null check(proposed_steps between 0 and 1000000),
 proposed_people smallint not null check(proposed_people between 1 and 100),
 proposed_group smallint not null references public.small_groups(id),
 proposed_division smallint not null references public.divisions(id),
 base_revision integer not null, before_result jsonb not null,
 status text not null default 'pending' check(status in('pending','accepted','rejected')),
 resolution_reason text, result jsonb,
 reviewed_by uuid references public.profiles(id) on delete set null, reviewer_name text,
 created_at timestamptz not null default now(), reviewed_at timestamptz,
 check(status='pending' or (reviewed_at is not null and length(btrim(resolution_reason)) between 1 and 2000 and result is not null))
);
create unique index activity_appeals_one_pending on public.activity_appeals(activity_id) where status='pending';
create index activity_appeals_queue on public.activity_appeals(status,created_at desc,id desc);
create index activity_appeals_history on public.activity_appeals(activity_id,created_at desc,id desc);
alter table public.activity_appeals enable row level security;
revoke all on public.activity_appeals from public,anon,authenticated;

create function public._appeal_values(a public.club_activities) returns jsonb language sql immutable set search_path='' as $$
 select jsonb_build_object('steps',a.steps,'people_count',a.people_count,'group_id',a.group_id,'division_id',a.division_id,'points',a.points,'revision',a.revision);
$$;
create function public._appeal_activity(a public.club_activities) returns jsonb language sql immutable set search_path='' as $$
 select public._appeal_values(a)||jsonb_build_object('activity_id',a.activity_id,'athlete_id',a.athlete_id,'athlete_name',a.athlete_name,'name',a.name,'start_local',a.start_local,'sport_type',a.sport_type,'status',a.status,'source_steps',a.source_steps,'media',a.media);
$$;
create function public._appeal_public(a public.activity_appeals) returns jsonb language sql immutable set search_path='' as $$
 select to_jsonb(a)-'requested_by'-'reviewed_by';
$$;
create function public._may_appeal(athlete bigint) returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and public.current_app_role() is not null and (
  exists(select 1 from public.members m where m.strava_athlete_id=athlete and m.auth_user_id=auth.uid() and m.active)
  or (public.current_app_role()='leader' and exists(select 1 from public.members me join public.members target on target.division_id=me.division_id
   where me.auth_user_id=auth.uid() and me.active and target.active and target.strava_athlete_id=athlete))
 );
$$;
revoke all on function public._appeal_values(public.club_activities),public._appeal_activity(public.club_activities),public._appeal_public(public.activity_appeals),public._may_appeal(bigint) from public,anon,authenticated;

create function public.submit_activity_appeal(target_id bigint,expected_revision integer,requested_steps integer,requested_people smallint,requested_group smallint,requested_division smallint,appeal_reason text) returns bigint
language plpgsql security definer set search_path='' as $$
declare a public.club_activities; p public.profiles; new_appeal public.activity_appeals; group_division smallint;
begin
 if not coalesce(public._may_appeal((select athlete_id from public.club_activities where activity_id=target_id)),false) then raise exception 'Bạn chỉ được khiếu nại hoạt động của mình hoặc thành viên thuộc liên đoàn phụ trách.' using errcode='42501'; end if;
 select * into a from public.club_activities where activity_id=target_id for update;
 if not coalesce(public._may_appeal(a.athlete_id),false) then raise exception 'Bạn không có quyền khiếu nại hoạt động này.' using errcode='42501'; end if;
 if a.status is distinct from 'approved' then raise exception 'Chỉ có thể khiếu nại hoạt động đã duyệt.'; end if;
 if a.revision is distinct from expected_revision then raise exception 'Hoạt động đã thay đổi. Hãy tải lại trước khi gửi khiếu nại.'; end if;
 if nullif(btrim(appeal_reason),'') is null or length(appeal_reason)>2000 then raise exception 'Nhập lý do khiếu nại, tối đa 2.000 ký tự.'; end if;
 if requested_steps is null or requested_steps not between 0 and 1000000 or requested_people is null or requested_people not between 1 and 100 then raise exception 'Số bước hoặc số người đi chung không hợp lệ.'; end if;
 if requested_group is null or requested_division is null then raise exception 'Chọn nhóm nhỏ và liên đoàn đề nghị.'; end if;
 if requested_group is distinct from a.group_id or requested_division is distinct from a.division_id then
  select division_id into group_division from public.small_groups where id=requested_group for share;
  if group_division is null or group_division is distinct from requested_division then raise exception 'Nhóm đề nghị không thuộc liên đoàn đã chọn.'; end if;
 end if;
 if row(requested_steps,requested_people,requested_group,requested_division) is not distinct from row(a.steps,a.people_count,a.group_id,a.division_id) then raise exception 'Đề nghị phải khác kết quả đã duyệt.'; end if;
 if exists(select 1 from public.activity_appeals where activity_id=target_id and status='pending') then raise exception 'Hoạt động đã có khiếu nại đang chờ xử lý.'; end if;
 select * into p from public.profiles where id=auth.uid();
 insert into public.activity_appeals(activity_id,requested_by,requester_name,requester_role,reason,proposed_steps,proposed_people,proposed_group,proposed_division,base_revision,before_result)
 values(target_id,auth.uid(),coalesce(nullif(btrim(p.full_name),''),'Thành viên'),p.role::text,btrim(appeal_reason),requested_steps,requested_people,requested_group,requested_division,a.revision,public._appeal_values(a)) returning * into new_appeal;
 insert into public.audit_log(actor_id,action,entity_id,after_data) values(auth.uid(),'submit_activity_appeal',target_id::text,public._appeal_public(new_appeal)||jsonb_build_object('athlete_id',a.athlete_id));
 return new_appeal.id;
end;
$$;

create function public.get_activity_appeals(activity_ids bigint[]) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
 if auth.uid() is null then raise exception 'Sign in required' using errcode='42501'; end if;
 if activity_ids is null or cardinality(activity_ids)>20 or coalesce(array_ndims(activity_ids),1)<>1 then raise exception 'Maximum 20 activities'; end if;
 select coalesce(jsonb_agg(jsonb_build_object('activity',public._appeal_activity(a),'can_submit',a.status='approved' and public._may_appeal(a.athlete_id) and not exists(select 1 from public.activity_appeals p where p.activity_id=a.activity_id and p.status='pending'),
 'appeals',coalesce((select jsonb_agg(public._appeal_public(h) order by h.created_at desc,h.id desc) from (select * from public.activity_appeals p where p.activity_id=a.activity_id order by p.created_at desc,p.id desc limit 10) h),'[]'::jsonb))),'[]'::jsonb) into result
 from public.club_activities a where a.activity_id=any(activity_ids) and (public.current_app_role()='admin' or public._may_appeal(a.athlete_id));
 return result;
end;
$$;

create function public.get_activity_appeal_page(status_filter text default 'pending',search_text text default '',page_number integer default 1) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
 if public.current_app_role() is distinct from 'admin' then raise exception 'Admin permission required' using errcode='42501'; end if;
 if status_filter is null or status_filter not in('pending','accepted','rejected') or page_number is null or page_number not between 1 and 10000 or length(coalesce(search_text,''))>200 then raise exception 'Invalid appeal filter'; end if;
 with scoped as (
  select p.id,p.activity_id,p.requester_name,p.reason,p.status,p.created_at,p.reviewed_at,p.resolution_reason,a.athlete_name,a.name
  from public.activity_appeals p join public.club_activities a on a.activity_id=p.activity_id
  where p.status=status_filter and (coalesce(btrim(search_text),'')='' or position(lower(btrim(search_text)) in lower(a.athlete_name||' '||a.name||' '||p.requester_name||' '||p.activity_id::text))>0)
 ), paged as(select * from scoped order by created_at desc,id desc limit 10 offset (page_number-1)*10)
 select jsonb_build_object('rows',coalesce((select jsonb_agg(to_jsonb(p) order by created_at desc,id desc) from paged p),'[]'::jsonb),'total',(select count(*) from scoped),
 'counts',(select jsonb_build_object('pending',count(*) filter(where status='pending'),'accepted',count(*) filter(where status='accepted'),'rejected',count(*) filter(where status='rejected')) from public.activity_appeals)) into result;
 return result;
end;
$$;

create function public.get_activity_appeal_detail(appeal_id bigint) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
 if public.current_app_role() is distinct from 'admin' then raise exception 'Admin permission required' using errcode='42501'; end if;
 select jsonb_build_object('appeal',public._appeal_public(p),'activity',public._appeal_activity(a)) into result from public.activity_appeals p join public.club_activities a on a.activity_id=p.activity_id where p.id=appeal_id;
 if result is null then raise exception 'Không tìm thấy khiếu nại.'; end if;
 return result;
end;
$$;

create function public.resolve_activity_appeal(appeal_id bigint,expected_revision integer,decision text,corrected_steps integer,corrected_people smallint,corrected_group smallint,corrected_division smallint,resolution text) returns void
language plpgsql security definer set search_path='' as $$
declare p public.activity_appeals; a public.club_activities; changed public.club_activities; activity_key bigint; group_division smallint; reviewer text;
begin
 if public.current_app_role() is distinct from 'admin' then raise exception 'Admin permission required' using errcode='42501'; end if;
 if decision is null or decision not in('accepted','rejected') then raise exception 'Invalid appeal decision'; end if;
 if nullif(btrim(resolution),'') is null or length(resolution)>2000 then raise exception 'Nhập lý do xử lý, tối đa 2.000 ký tự.'; end if;
 select activity_id into activity_key from public.activity_appeals where id=appeal_id;
 if not found then raise exception 'Không tìm thấy khiếu nại.'; end if;
 -- All mutations lock the activity first; a duplicate submission/review cannot race this decision.
 select * into a from public.club_activities where activity_id=activity_key for update;
 select * into p from public.activity_appeals where id=appeal_id for update;
 if p.status<>'pending' then raise exception 'Khiếu nại đã được xử lý. Hãy tải lại.'; end if;
 if decision='accepted' then
  if a.revision is distinct from expected_revision then raise exception 'Hoạt động đã thay đổi. Hãy tải lại trước khi xử lý.'; end if;
  if a.status<>'approved' or a.sport_type<>'Walk' or a.start_local<'2026-10-04' or a.start_local>='2026-11-16' then raise exception 'Hoạt động không còn đủ điều kiện đã duyệt.'; end if;
  if corrected_steps is null or corrected_steps not between 0 and 1000000 or corrected_people is null or corrected_people not between 1 and 100 then raise exception 'Số bước hoặc số người đi chung không hợp lệ.'; end if;
  if corrected_group is null or corrected_division is null then raise exception 'Chọn nhóm nhỏ và liên đoàn ghi nhận.'; end if;
  if corrected_group is distinct from a.group_id or corrected_division is distinct from a.division_id then
   select division_id into group_division from public.small_groups where id=corrected_group for share;
   if group_division is null or group_division is distinct from corrected_division then raise exception 'Nhóm không thuộc liên đoàn đã chọn.'; end if;
  end if;
  update public.club_activities set steps=corrected_steps,people_count=corrected_people,group_id=corrected_group,division_id=corrected_division,
   reviewed_by=auth.uid(),reviewed_at=now(),revision=revision+1,updated_at=now() where activity_id=a.activity_id returning * into changed;
  insert into public.audit_log(actor_id,action,entity_id,before_data,after_data) values(auth.uid(),'review_activity',a.activity_id::text,to_jsonb(a),to_jsonb(changed)||jsonb_build_object('appeal_id',p.id,'appeal_resolution',btrim(resolution)));
 else changed:=a;
 end if;
 select coalesce(nullif(btrim(full_name),''),'Admin') into reviewer from public.profiles where id=auth.uid();
 update public.activity_appeals set status=decision,resolution_reason=btrim(resolution),result=public._appeal_values(changed),reviewed_by=auth.uid(),reviewer_name=reviewer,reviewed_at=now() where id=p.id;
 insert into public.audit_log(actor_id,action,entity_id,before_data,after_data) values(auth.uid(),'resolve_activity_appeal',a.activity_id::text,public._appeal_public(p),jsonb_build_object('appeal_id',p.id,'status',decision,'resolution_reason',btrim(resolution),'result',public._appeal_values(changed),'athlete_id',a.athlete_id));
end;
$$;
revoke all on function public.submit_activity_appeal(bigint,integer,integer,smallint,smallint,smallint,text),public.get_activity_appeals(bigint[]),public.get_activity_appeal_page(text,text,integer),public.get_activity_appeal_detail(bigint),public.resolve_activity_appeal(bigint,integer,text,integer,smallint,smallint,smallint,text) from public,anon;
grant execute on function public.submit_activity_appeal(bigint,integer,integer,smallint,smallint,smallint,text),public.get_activity_appeals(bigint[]),public.get_activity_appeal_page(text,text,integer),public.get_activity_appeal_detail(bigint),public.resolve_activity_appeal(bigint,integer,text,integer,smallint,smallint,smallint,text) to authenticated;
