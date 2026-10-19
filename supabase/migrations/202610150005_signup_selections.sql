-- Public signup reads only a bounded page of unlinked Strava names/IDs and assignments.
create function public.get_signup_options(search_text text default '',page_number integer default 1) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
 if search_text is null or length(search_text)>100 or page_number is null or page_number<1 or page_number>10000 then raise exception 'Invalid search'; end if;
 with available as (
  select strava_athlete_id,strava_name,division_id,group_id from public.members
  where active and auth_user_id is null and (btrim(search_text)='' or position(lower(btrim(search_text)) in lower(strava_name||' '||strava_athlete_id::text))>0)
 ), paged as (select * from available order by strava_name,strava_athlete_id limit 10 offset (page_number-1)*10)
 select jsonb_build_object('members',coalesce((select jsonb_agg(to_jsonb(p) order by strava_name,strava_athlete_id) from paged p),'[]'::jsonb),
  'total',(select count(*) from available),'groups',coalesce((select jsonb_agg(jsonb_build_object('id',id,'name',name,'division_id',division_id) order by division_id,id) from public.small_groups where division_id is not null),'[]'::jsonb)) into result;
 return result;
end;
$$;
revoke all on function public.get_signup_options(text,integer) from public;
grant execute on function public.get_signup_options(text,integer) to anon,authenticated;

create function public.validate_signup_selection(selected_group smallint,selected_athlete bigint) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare member_row public.members; chosen_group smallint; chosen_division smallint;
begin
 if selected_athlete is null or selected_athlete<1 or selected_athlete>999999999999999 or selected_group is null then raise exception 'Vui lòng chọn nhóm nhỏ và tài khoản Strava.'; end if;
 select * into member_row from public.members where strava_athlete_id=selected_athlete;
 if found and (not member_row.active or member_row.auth_user_id is not null) then raise exception 'Tài khoản Strava này không khả dụng. Vui lòng liên hệ BTC.'; end if;
 chosen_group=coalesce(member_row.group_id,selected_group);
 select division_id into chosen_division from public.small_groups where id=chosen_group;
 if not found or chosen_division is null then raise exception 'Nhóm nhỏ không hợp lệ. Vui lòng chọn lại.'; end if;
 return jsonb_build_object('group_id',chosen_group,'division_id',chosen_division,'athlete_id',selected_athlete,'strava_url','https://www.strava.com/athletes/'||selected_athlete);
end;
$$;
revoke all on function public.validate_signup_selection(smallint,bigint) from public;
grant execute on function public.validate_signup_selection(smallint,bigint) to anon,authenticated;

alter table public.profiles add column requested_group_id smallint references public.small_groups(id),
 add column requested_strava_athlete_id bigint check(requested_strava_athlete_id>0),add column requested_strava_url text;
create or replace function public.handle_signup() returns trigger language plpgsql security definer set search_path='' as $$
declare selection jsonb;
begin
 -- Legacy/admin-created accounts may omit both fields; new form submissions supply both.
 if new.raw_user_meta_data ? 'requested_group_id' or new.raw_user_meta_data ? 'requested_strava_athlete_id' then
  if coalesce(new.raw_user_meta_data->>'requested_group_id','') !~ '^([1-9]|10)$' or coalesce(new.raw_user_meta_data->>'requested_strava_athlete_id','') !~ '^[1-9][0-9]{0,14}$' then raise exception 'Vui lòng chọn nhóm nhỏ và tài khoản Strava.'; end if;
  selection=public.validate_signup_selection((new.raw_user_meta_data->>'requested_group_id')::smallint,(new.raw_user_meta_data->>'requested_strava_athlete_id')::bigint);
 end if;
 insert into public.profiles(id,email,full_name,birth_year,gender,requested_group_id,requested_strava_athlete_id,requested_strava_url)
 values(new.id,coalesce(new.email,''),nullif(btrim(coalesce(new.raw_user_meta_data->>'full_name','')),''),nullif(new.raw_user_meta_data->>'birth_year','')::smallint,nullif(new.raw_user_meta_data->>'gender',''),
 (selection->>'group_id')::smallint,(selection->>'athlete_id')::bigint,selection->>'strava_url')
 on conflict(id) do update set email=excluded.email,full_name=coalesce(excluded.full_name,public.profiles.full_name),birth_year=coalesce(excluded.birth_year,public.profiles.birth_year),gender=coalesce(excluded.gender,public.profiles.gender);
 return new;
end;
$$;
-- Link an account to one roster member without changing group assignments.
create or replace function public.link_account_member(account_id uuid, athlete_id bigint, expected_athlete_id bigint)
returns void language plpgsql security definer set search_path = '' as $$
declare
  account_row public.profiles;
  old_member public.members;
  new_member public.members;
  old_data jsonb;
  new_data jsonb;
  requested_division smallint;
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
  -- Admin confirmation applies a requested group only to the requested, unassigned athlete.
  if new_member.group_id is null and account_row.requested_strava_athlete_id=athlete_id and account_row.requested_group_id is not null then
    select division_id into requested_division from public.small_groups where id=account_row.requested_group_id and division_id is not null;
    if not found then raise exception 'Nhóm đăng ký đã thay đổi. Vui lòng phân nhóm lại.'; end if;
    new_member.group_id=account_row.requested_group_id;new_member.division_id=requested_division;
  end if;
  if account_row.role='leader' and new_member.division_id is null then
    raise exception 'LĐ trưởng cần liên kết với thành viên đã phân LĐ.';
  end if;
  if old_member.strava_athlete_id=athlete_id then return; end if;
  old_data:=jsonb_build_object('email',account_row.email,'member_id',old_member.strava_athlete_id,'member_name',coalesce(old_member.btn_name,old_member.strava_name),'division_id',old_member.division_id,'group_id',old_member.group_id);
  new_data:=jsonb_build_object('email',account_row.email,'member_id',new_member.strava_athlete_id,'member_name',coalesce(new_member.btn_name,new_member.strava_name),'division_id',new_member.division_id,'group_id',new_member.group_id);
  update public.members set auth_user_id=null,updated_at=now() where auth_user_id=account_id;
  update public.members set auth_user_id=account_id,group_id=new_member.group_id,division_id=new_member.division_id,updated_at=now() where strava_athlete_id=athlete_id;
  insert into public.audit_log(actor_id,action,entity_id,before_data,after_data)
    values(auth.uid(),'link_account_member',account_id::text,old_data,new_data);
end;
$$;
revoke execute on function public.link_account_member(uuid,bigint,bigint) from public,anon;
grant execute on function public.link_account_member(uuid,bigint,bigint) to authenticated;
