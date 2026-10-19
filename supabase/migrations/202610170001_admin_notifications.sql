-- Durable admin inbox; read receipts belong to each administrator separately.
create table public.admin_notifications (
 id bigint generated always as identity primary key,
 kind text not null check(kind in('registration','appeal')),
 target_id text not null,
 actor_name text not null,
 created_at timestamptz not null default now(),
 unique(kind,target_id)
);
create table public.admin_notification_reads (
 admin_id uuid not null references public.profiles(id) on delete cascade,
 notification_id bigint not null references public.admin_notifications(id) on delete cascade,
 read_at timestamptz not null default now(),
 primary key(admin_id,notification_id)
);
create index admin_notifications_recent on public.admin_notifications(created_at desc,id desc);
alter table public.admin_notifications enable row level security;
alter table public.admin_notification_reads enable row level security;
revoke all on public.admin_notifications,public.admin_notification_reads from public,anon,authenticated;
revoke all on sequence public.admin_notifications_id_seq from public,anon,authenticated;

create function private.notify_registration() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if new.email_verified_at is not null and new.approved_at is null and new.role<>'admin'
    and not exists(select 1 from public.members where auth_user_id=new.id) then
  insert into public.admin_notifications(kind,target_id,actor_name,created_at)
  values('registration',new.id::text,coalesce(nullif(btrim(new.full_name),''),'Thành viên mới'),new.email_verified_at)
  on conflict(kind,target_id) do nothing;
 end if;
 return new;
end;
$$;
revoke all on function private.notify_registration() from public,anon,authenticated;
create trigger notify_admin_registration after insert or update of email_verified_at on public.profiles
 for each row execute function private.notify_registration();

create function private.notify_appeal() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 insert into public.admin_notifications(kind,target_id,actor_name,created_at)
 values('appeal',new.id::text,new.requester_name,new.created_at) on conflict(kind,target_id) do nothing;
 return new;
end;
$$;
revoke all on function private.notify_appeal() from public,anon,authenticated;
create trigger notify_admin_appeal after insert on public.activity_appeals
 for each row execute function private.notify_appeal();

-- Seed only work that is currently waiting, without flooding the inbox with history.
insert into public.admin_notifications(kind,target_id,actor_name,created_at)
select 'registration',p.id::text,coalesce(nullif(btrim(p.full_name),''),'Thành viên mới'),p.email_verified_at
from public.profiles p where p.email_verified_at is not null and p.approved_at is null and p.role<>'admin'
 and not exists(select 1 from public.members m where m.auth_user_id=p.id)
on conflict(kind,target_id) do nothing;
insert into public.admin_notifications(kind,target_id,actor_name,created_at)
select 'appeal',id::text,requester_name,created_at from public.activity_appeals where status='pending'
on conflict(kind,target_id) do nothing;

create function public.get_admin_notifications(page_number integer default 1) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
 if public.current_app_role() is distinct from 'admin' then raise exception 'Chỉ admin được xem thông báo.' using errcode='42501'; end if;
 if page_number is null or page_number<1 or page_number>10000 then raise exception 'Trang không hợp lệ.'; end if;
 with page as (
  select * from public.admin_notifications order by created_at desc,id desc limit 10 offset (page_number-1)*10
 ), items as (
  select n.id,n.kind,n.target_id,n.actor_name,n.created_at,r.read_at,
   case when n.kind='registration' then p.id is not null else a.id is not null end as available,
   case when n.kind='registration' then case when p.id is null then 'unavailable'
     when p.approved_at is not null or p.role='admin' or exists(select 1 from public.members m where m.auth_user_id=p.id) then 'approved' else 'pending' end
    else coalesce(a.status,'unavailable') end as status
  from page n left join public.admin_notification_reads r on r.notification_id=n.id and r.admin_id=auth.uid()
  left join public.profiles p on n.kind='registration' and p.id::text=n.target_id
  left join public.activity_appeals a on n.kind='appeal' and a.id::text=n.target_id
 )
 select jsonb_build_object('rows',coalesce((select jsonb_agg(to_jsonb(i) order by created_at desc,id desc) from items i),'[]'::jsonb),
  'total',(select count(*) from public.admin_notifications),
  'latest_id',coalesce((select max(id) from public.admin_notifications),0),
  'unread_count',(select count(*) from public.admin_notifications n where not exists(select 1 from public.admin_notification_reads r where r.notification_id=n.id and r.admin_id=auth.uid()))) into result;
 return result;
end;
$$;
revoke all on function public.get_admin_notifications(integer) from public,anon;
grant execute on function public.get_admin_notifications(integer) to authenticated;

create function public.mark_admin_notifications_read(notification_ids bigint[] default null,up_to_id bigint default null) returns void
language plpgsql security definer set search_path='' as $$
begin
 if public.current_app_role() is distinct from 'admin' then raise exception 'Chỉ admin được cập nhật thông báo.' using errcode='42501'; end if;
 if (notification_ids is null)=(up_to_id is null) or up_to_id<0
    or (notification_ids is not null and (cardinality(notification_ids) not between 1 and 50 or exists(select 1 from unnest(notification_ids) x where x is null or x<1))) then
  raise exception 'Thông báo không hợp lệ.';
 end if;
 insert into public.admin_notification_reads(admin_id,notification_id)
 select auth.uid(),n.id from public.admin_notifications n where n.id=any(notification_ids) or n.id<=up_to_id
 on conflict(admin_id,notification_id) do nothing;
end;
$$;
revoke all on function public.mark_admin_notifications_read(bigint[],bigint) from public,anon;
grant execute on function public.mark_admin_notifications_read(bigint[],bigint) to authenticated;
