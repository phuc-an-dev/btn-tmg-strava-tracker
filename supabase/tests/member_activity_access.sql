begin;
insert into auth.users(id,email) values('00000000-0000-0000-0000-000000000081','activity-test-1@example.test'),('00000000-0000-0000-0000-000000000082','activity-test-2@example.test');
insert into public.members(strava_athlete_id,strava_name,auth_user_id,group_id,division_id,source_url,synced_at)
select 999999999999981,'Test Own','00000000-0000-0000-0000-000000000081',id,division_id,'https://www.strava.com/clubs/2368312/members',now() from public.small_groups where division_id is not null limit 1;
insert into public.members(strava_athlete_id,strava_name,auth_user_id,group_id,division_id,source_url,synced_at)
select 999999999999982,'Test Other','00000000-0000-0000-0000-000000000082',id,division_id,'https://www.strava.com/clubs/2368312/members',now() from public.small_groups where division_id is not null limit 1;
insert into public.club_activities(activity_id,athlete_id,athlete_name,name,sport_type,start_local,steps,source_steps,people_count,division_id,group_id,status,note,rejection_reason,source,reviewed_by,reviewed_at)
select x.id,m.strava_athlete_id,m.strava_name,'Member Activity Test '||x.status,'Walk','2026-10-13 10:00',6000,6000,10,m.division_id,m.group_id,x.status,'PRIVATE_NOTE','Bổ sung số bước để đối chiếu.','{"private":"SOURCE_SECRET"}',case when x.status<>'pending' then (select id from public.profiles where role='admin' limit 1) end,case when x.status<>'pending' then now() end
from (values(999999999999981::bigint,999999999999981::bigint,'pending'),(999999999999982,999999999999981,'approved'),(999999999999983,999999999999981,'rejected'),(999999999999984,999999999999982,'pending'),(999999999999985,999999999999982,'approved')) as x(id,athlete,status) join public.members m on m.strava_athlete_id=x.athlete;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000081',true);
set local role authenticated;
do $$ declare result jsonb; row jsonb; first_id text; begin
 result:=public.get_member_activities('mine','Member Activity Test');
 if (result->>'total')::int<>3 then raise exception 'Own statuses not visible'; end if;
 if (result->>'approved_points')::int<>12000 or (result->>'pending_points')::int<>12000 then raise exception 'Points summary incorrect'; end if;
 for row in select * from jsonb_array_elements(result->'rows') loop
  if row ? 'note' or row ? 'source' or row ? 'reviewed_by' then raise exception 'Private fields leaked'; end if;
  if (row->>'athlete_id')::bigint<>999999999999981 then raise exception 'Other private activity leaked'; end if;
  if row->>'status'='rejected' and row->>'rejection_reason'<>'Bổ sung số bước để đối chiếu.' then raise exception 'Own rejection reason missing'; end if;
 end loop;
 result:=public.get_member_activities('club','Member Activity Test');
 if (result->>'total')::int<>5 then raise exception 'Club activity statuses missing'; end if;
 for row in select * from jsonb_array_elements(result->'rows') loop
  if row ? 'note' or row ? 'source' or row ? 'reviewed_by' then raise exception 'Club private fields leaked'; end if;
  if (row->>'athlete_id')::bigint<>999999999999981 and row->>'rejection_reason'<>'' then raise exception 'Other rejection reason leaked'; end if;
 end loop;
 result:=public.get_member_activities('mine','Member Activity Test',null,null,'all',1,1);
 first_id:=result->'rows'->0->>'activity_id';
 if jsonb_array_length(result->'rows')<>1 or (result->>'total')::int<>3 then raise exception 'Pagination failed'; end if;
 result:=public.get_member_activities('mine','Member Activity Test',null,null,'all',2,1);
 if first_id=result->'rows'->0->>'activity_id' then raise exception 'Pagination duplicated row'; end if;
 if (select count(*) from public.club_activities)>0 then raise exception 'Member can read internal table'; end if;
 if (select count(*) from public.audit_log)>0 then raise exception 'Member can read audit'; end if;
 begin
  perform public.review_club_activity(999999999999981,1,6000,10::smallint,1::smallint,'','approved');
  raise exception 'Member can approve';
 exception when insufficient_privilege then null;
 end;
 if has_function_privilege('anon','public.get_member_activities(text,text,smallint,smallint,text,integer,integer)','execute') then raise exception 'Anon granted access'; end if;
end $$;
reset role;
update public.members set active=false where strava_athlete_id=999999999999981;
set local role authenticated;
do $$ begin
 begin
  perform public.get_member_activities();
  raise exception 'Inactive member accepted';
 exception when insufficient_privilege then null;
 end;
end $$;
rollback;
