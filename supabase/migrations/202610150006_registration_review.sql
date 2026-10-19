alter table public.profiles
 add column email_verified_at timestamptz,
 add column approved_at timestamptz,
 add column approved_by uuid references public.profiles(id) on delete set null;

update public.profiles p set email_verified_at=u.email_confirmed_at from auth.users u where u.id=p.id;

create function private.sync_signup_email() returns trigger language plpgsql security definer set search_path='' as $$
begin
 update public.profiles set email_verified_at=new.email_confirmed_at where id=new.id;
 return new;
end;
$$;
revoke all on function private.sync_signup_email() from public,anon,authenticated;
create trigger zz_sync_signup_email after insert or update of email_confirmed_at on auth.users
 for each row execute function private.sync_signup_email();

create function public.approve_registration(account_id uuid) returns void language plpgsql security definer set search_path='' as $$
declare account_row public.profiles; linked_id bigint; review_time timestamptz=now();
begin
 if public.current_app_role() is distinct from 'admin' then raise exception 'Chỉ admin được duyệt đăng ký.' using errcode='42501'; end if;
 select * into account_row from public.profiles where id=account_id for update;
 if not found then raise exception 'Không tìm thấy hồ sơ đăng ký.'; end if;
 select strava_athlete_id into linked_id from public.members where auth_user_id=account_id;
 if account_row.approved_at is not null then return; end if;
 if linked_id is not null or account_row.role='admin' then raise exception 'Tài khoản đã được xác nhận trước đây. Hãy kiểm tra Chi tiết.'; end if;
 if not exists(select 1 from auth.users where id=account_id and email_confirmed_at is not null) then raise exception 'Người đăng ký chưa xác thực email.'; end if;
 if nullif(btrim(account_row.full_name),'') is null or account_row.birth_year is null or account_row.gender is null
    or account_row.requested_group_id is null or account_row.requested_strava_athlete_id is null then
  raise exception 'Hồ sơ đăng ký chưa đủ thông tin. Hãy kiểm tra Chi tiết.';
 end if;
 -- The existing linking RPC locks the selected roster row, rejects claims by another
 -- account, retains assigned groups and applies the requested group only if unassigned.
 perform public.link_account_member(account_id,account_row.requested_strava_athlete_id,null);
 update public.profiles set approved_at=review_time,approved_by=auth.uid() where id=account_id;
 insert into public.audit_log(actor_id,action,entity_id,before_data,after_data)
 values(auth.uid(),'approve_registration',account_id::text,
 jsonb_build_object('status','pending'),
 jsonb_build_object('status','approved','email',account_row.email,'full_name',account_row.full_name,'member_id',account_row.requested_strava_athlete_id,'approved_at',review_time));
end;
$$;
revoke all on function public.approve_registration(uuid) from public,anon;
grant execute on function public.approve_registration(uuid) to authenticated;
