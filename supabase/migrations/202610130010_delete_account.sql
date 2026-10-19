-- Preserve attribution and competition results when an admin removes a login.
alter table public.audit_log add column actor_snapshot jsonb;
alter table public.club_activities add column imported_by_snapshot jsonb, add column reviewed_by_snapshot jsonb;
alter table public.club_activities drop constraint club_activities_check;
alter table public.club_activities add constraint club_activities_check check (
 status<>'approved' or (steps is not null and people_count is not null and division_id is not null and group_id is not null
 and (reviewed_by is not null or coalesce(reviewed_by_snapshot->>'id','')<>'')
 and sport_type='Walk' and start_local>='2026-10-04' and start_local<'2026-11-16')
);

create function public.delete_account(account_id uuid, confirmation_email text) returns void
language plpgsql security definer set search_path='' as $$
declare account_row public.profiles; member_row public.members; snapshot jsonb;
begin
 perform pg_advisory_xact_lock(2368312);
 if public.current_app_role() is distinct from 'admin' then
  raise exception 'Chỉ admin được xóa tài khoản.' using errcode='42501';
 end if;
 select * into account_row from public.profiles where id=account_id for update;
 if not found then raise exception 'Tài khoản không còn tồn tại.'; end if;
 if account_row.role='admin' and (select count(*) from public.profiles where role='admin')<=1 then
  raise exception 'Không thể xóa admin cuối cùng.';
 end if;
 if account_id=auth.uid() then raise exception 'Không thể xóa tài khoản đang đăng nhập. Hãy dùng một admin khác.'; end if;
 if confirmation_email is null or lower(trim(confirmation_email))<>lower(account_row.email)
 or not exists(select 1 from auth.users where id=account_id and lower(email)=lower(trim(confirmation_email))) then
  raise exception 'Email xác nhận không khớp.';
 end if;
 if exists(select 1 from storage.objects where owner_id=account_id::text) then
  raise exception 'Tài khoản còn sở hữu tệp. Cần chuyển quyền sở hữu trước khi xóa.';
 end if;
 select * into member_row from public.members where auth_user_id=account_id for update;
 snapshot:=jsonb_build_object('id',account_row.id,'email',account_row.email,'role',account_row.role,'full_name',account_row.full_name);
 update public.audit_log set actor_snapshot=snapshot,actor_id=null where actor_id=account_id;
 update public.club_activities set imported_by_snapshot=snapshot,imported_by=null where imported_by=account_id;
 update public.club_activities set reviewed_by_snapshot=snapshot,reviewed_by=null where reviewed_by=account_id;
 insert into public.audit_log(actor_id,action,entity_id,before_data,after_data)
 values(auth.uid(),'delete_account',account_id::text,snapshot||jsonb_build_object('member_name',coalesce(member_row.btn_name,member_row.strava_name),'member_id',member_row.strava_athlete_id),jsonb_build_object('deleted',true,'member_retained',true));
 -- Cascades remove identities/sessions/profile; roster FK only clears its login link.
 delete from auth.users where id=account_id;
 if not found then raise exception 'Tài khoản không còn tồn tại.'; end if;
end;
$$;
revoke execute on function public.delete_account(uuid,text) from public,anon;
grant execute on function public.delete_account(uuid,text) to authenticated;
