-- Keep the RPC signature compatible with existing clients. No historical activities are rewritten.
create or replace function public.review_club_activity(target_id bigint,expected_revision integer,new_steps integer,new_people smallint,new_division smallint,new_note text,decision text,new_rejection_reason text default null) returns void
language plpgsql security definer set search_path='' as $$
declare old_row public.club_activities; new_row public.club_activities; member public.members; assigned_group smallint; assigned_division smallint:=new_division;
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
  -- Credit the locked roster assignment, independently of the parsed title or client value.
  assigned_division:=member.division_id;
  if old_row.sport_type<>'Walk' or old_row.start_local<'2026-10-04' or old_row.start_local>='2026-11-16' then raise exception 'Activity is outside the competition period or not Walk'; end if;
  if new_steps is null or new_people is null then raise exception 'Steps and party size are required'; end if;
  if old_row.source_steps is distinct from new_steps and nullif(btrim(new_note),'') is null then raise exception 'Explain corrected or manually supplied steps in the note'; end if;
  assigned_group:=member.group_id;
 end if;
 update public.club_activities set steps=new_steps,people_count=new_people,division_id=assigned_division,group_id=assigned_group,note=coalesce(new_note,''),status=decision,rejection_reason=case when decision='rejected' then coalesce(nullif(btrim(new_rejection_reason),''),nullif(old_row.rejection_reason,''),'Hoạt động chưa được công nhận. Vui lòng liên hệ admin để được hướng dẫn.') else '' end,
 reviewed_by=case when decision='pending' then null else auth.uid() end,reviewed_at=case when decision='pending' then null else now() end,revision=revision+1,updated_at=now()
 where activity_id=target_id returning * into new_row;
 insert into public.audit_log(actor_id,action,entity_id,before_data,after_data) values(auth.uid(),'review_activity',target_id::text,to_jsonb(old_row),to_jsonb(new_row));
end;
$$;

revoke all on function public.review_club_activity(bigint,integer,integer,smallint,smallint,text,text,text) from public,anon;
grant execute on function public.review_club_activity(bigint,integer,integer,smallint,smallint,text,text,text) to authenticated;

