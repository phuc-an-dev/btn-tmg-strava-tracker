-- Read-only authorization checks against the deployed database. No fixture rows.
begin;
set local role anon;
do $$
declare roster jsonb; r jsonb; blocked boolean;
begin
 roster:=public.get_public_portal();
 if jsonb_typeof(roster->'members')<>'array' or jsonb_typeof(roster->'groups')<>'array' then raise exception 'Invalid public roster'; end if;
 if exists(select 1 from jsonb_array_elements(roster->'members') m where m ?| array['auth_user_id','email','birth_year']) then raise exception 'Account data exposed'; end if;
 r:=public.get_rankings('event');
 if r->'summary' is null or exists(select 1 from jsonb_array_elements(r->'individuals') p where (p->>'is_me')::boolean) then raise exception 'Invalid anonymous rankings'; end if;
 perform public.get_rankings('week');
 perform public.get_kudos_rankings('event');
 perform public.get_kudos_rankings('week');
 perform public.get_activity_statistics('individuals','week','{}');
 perform public.get_activity_statistics('groups','event','{1,2}');
 perform public.get_activity_statistics('divisions','week','{1,2,3,4,5}');
 r:=public.get_member_activities('club');
 if jsonb_typeof(r->'rows')<>'array' or jsonb_array_length(r->'rows')>10 then raise exception 'Invalid public activity pagination'; end if;
 if exists(select 1 from jsonb_array_elements(r->'rows') a where a->>'rejection_reason'<>'') then raise exception 'Private rejection reason exposed'; end if;
 perform public.get_member_activities('club','',null,null,'approved',1,5);
 perform public.get_incomplete_post_page('club');
 perform public.get_contribution_statistics('individuals','event');
 perform public.get_honors('individuals');
 blocked:=false;
 begin perform public.get_member_activities('mine'); exception when insufficient_privilege then blocked:=true; end;
 if not blocked then raise exception 'Anonymous personal activities allowed'; end if;
 blocked:=false;
 begin perform public.get_incomplete_post_page('mine'); exception when insufficient_privilege then blocked:=true; end;
 if not blocked then raise exception 'Anonymous personal reports allowed'; end if;
 if has_table_privilege('anon','public.profiles','select') or has_table_privilege('anon','public.members','select') or has_table_privilege('anon','public.activity_appeals','select') then raise exception 'Private table access widened'; end if;
 if has_function_privilege('anon','public.submit_activity_appeal(bigint,integer,integer,smallint,smallint,smallint,text)','execute') or has_function_privilege('anon','public.get_activity_appeals(bigint[])','execute') then raise exception 'Anonymous appeal access allowed'; end if;
end;
$$;
reset role;
select 'Public read, bounded pagination, personal-scope denial and private-data isolation passed' result;
rollback;
