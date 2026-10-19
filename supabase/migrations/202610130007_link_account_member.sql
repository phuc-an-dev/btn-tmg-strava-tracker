-- Link an account to one roster member without changing group assignments.
create function public.link_account_member(account_id uuid, athlete_id bigint, expected_athlete_id bigint)
returns void language plpgsql security definer set search_path = '' as $$
declare
  account_row public.profiles;
  old_member public.members;
  new_member public.members;
  old_data jsonb;
  new_data jsonb;
begin
  if public.current_app_role() is distinct from 'admin' then
    raise exception 'Chỉ admin được liên kết tài khoản.' using errcode='42501';
  end if;
  select * into account_row from public.profiles where id=account_id for update;
  if not found then raise exception 'Không tìm thấy tài khoản.'; end if;
  perform 1 from public.members where auth_user_id=account_id or strava_athlete_id=athlete_id order by strava_athlete_id for update;
  select * into old_member from public.members where auth_user_id=account_id;
  if old_member.strava_athlete_id is distinct from expected_athlete_id then
    raise exception 'Liên kết đã thay đổi. Hãy tải lại danh sách.' using errcode='40001';
  end if;
  select * into new_member from public.members where strava_athlete_id=athlete_id;
  if not found or not new_member.active then raise exception 'Thành viên không tồn tại hoặc không còn tham gia.'; end if;
  if new_member.auth_user_id is not null and new_member.auth_user_id<>account_id then
    raise exception 'Thành viên đã liên kết với tài khoản khác.';
  end if;
  if account_row.role='leader' and new_member.division_id is null then
    raise exception 'LĐ trưởng cần liên kết với thành viên đã phân LĐ.';
  end if;
  if old_member.strava_athlete_id=athlete_id then return; end if;
  old_data:=jsonb_build_object('email',account_row.email,'member_id',old_member.strava_athlete_id,'member_name',coalesce(old_member.btn_name,old_member.strava_name),'division_id',old_member.division_id,'group_id',old_member.group_id);
  new_data:=jsonb_build_object('email',account_row.email,'member_id',new_member.strava_athlete_id,'member_name',coalesce(new_member.btn_name,new_member.strava_name),'division_id',new_member.division_id,'group_id',new_member.group_id);
  update public.members set auth_user_id=null,updated_at=now() where auth_user_id=account_id;
  update public.members set auth_user_id=account_id,updated_at=now() where strava_athlete_id=athlete_id;
  insert into public.audit_log(actor_id,action,entity_id,before_data,after_data)
    values(auth.uid(),'link_account_member',account_id::text,old_data,new_data);
end;
$$;
revoke execute on function public.link_account_member(uuid,bigint,bigint) from public,anon;
grant execute on function public.link_account_member(uuid,bigint,bigint) to authenticated;
