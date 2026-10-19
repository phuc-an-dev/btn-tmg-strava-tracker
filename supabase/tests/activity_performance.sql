begin;
do $$
declare admin_id uuid; user_id uuid; r jsonb; old jsonb; expected integer; wanted jsonb; state text; page integer; div smallint; scope text;
begin
 select id into admin_id from public.profiles where role='admin' limit 1;
 if admin_id is null then raise exception 'Admin fixture required'; end if;
 perform set_config('request.jwt.claim.sub',admin_id::text,true);
 foreach state in array array['pending','approved','rejected'] loop
  foreach div in array array[null::smallint,1::smallint,5::smallint] loop
   select count(*) into expected from public.club_activities a where a.sport_type='Walk' and a.start_local>='2026-10-04' and a.start_local<'2026-11-16' and a.status=state and (div is null or a.division_id=div);
   foreach page in array array[1,2,10000] loop
    r=public.get_review_activity_page('',state,div,page,false);
    if (r->>'total')::integer<>expected or jsonb_array_length(r->'rows')<>least(10,greatest(0,expected-(page-1)*10)) then raise exception 'Invalid review pagination'; end if;
    select coalesce(jsonb_agg(activity_id order by start_local desc,activity_id desc),'[]'::jsonb) into wanted from (select activity_id,start_local from public.club_activities a where a.sport_type='Walk' and a.start_local>='2026-10-04' and a.start_local<'2026-11-16' and a.status=state and (div is null or a.division_id=div) order by start_local desc,activity_id desc limit 10 offset (page-1)*10) a;
    if jsonb_path_query_array(r,'$.rows[*].activity_id')<>wanted then raise exception 'Review order changed'; end if;
    if exists(select 1 from jsonb_array_elements(r->'rows') p where p->'source' ? 'source_posts' or p ? 'note' or p ? 'imported_by') then raise exception 'List carries detail-only payload'; end if;
   end loop;
  end loop;
 end loop;
 r=public.get_review_activity_page('THIS_SEARCH_HAS_NO_MATCH','pending',null,1,false);
 if (r->>'total')::integer<>0 or r->'rows'<>'[]'::jsonb then raise exception 'Search did not filter'; end if;
 r=public.get_review_activity_page('','pending',null,1,true);
 if r->'rows'<>'[]'::jsonb then raise exception 'Summary-only query returned rows'; end if;
 select count(*) into expected from public.club_activities where status='pending' and sport_type='Walk' and start_local>='2026-10-04' and start_local<'2026-11-16';
 if (r->'counts'->>'pending')::integer<>expected then raise exception 'Wrong pending count'; end if;
 if (r->>'approved_points')::numeric<>(select coalesce(sum(points),0) from public.club_activities where status='approved') then raise exception 'Wrong approved total'; end if;
 foreach scope in array array['mine','club'] loop
  old=public.get_incomplete_posts(scope,'',null,null);
  r=public.get_incomplete_post_page(scope,'',null,null,1,false);
  if (r->>'total')::integer<>jsonb_array_length(old) or r->'rows'<>jsonb_path_query_array(old,'$[0 to 9]') then raise exception 'Report page changed content or order'; end if;
  r=public.get_incomplete_post_page(scope,'',null,null,2,false);
  if r->'rows'<>jsonb_path_query_array(old,'$[10 to 19]') then raise exception 'Wrong second report page'; end if;
  r=public.get_incomplete_post_page(scope,'',null,null,1,true);
  if r->'rows'<>'[]'::jsonb or (r->>'total')::integer<>jsonb_array_length(old) then raise exception 'Invalid count-only reports'; end if;
 end loop;
 -- A signed-in identity without a profile/roster must not gain reviewer or report access.
 perform set_config('request.jwt.claim.sub',gen_random_uuid()::text,true);
 begin perform public.get_review_activity_page();raise exception 'Non-reviewer gained access';exception when insufficient_privilege then null;end;
 begin perform public.get_incomplete_post_page();raise exception 'Unlinked account gained access';exception when insufficient_privilege then null;end;
 select p.id into user_id from public.profiles p join public.members m on m.auth_user_id=p.id and m.active where p.role='user' limit 1;
 if user_id is not null then
  perform set_config('request.jwt.claim.sub',user_id::text,true);
  begin perform public.get_review_activity_page();raise exception 'Member gained reviewer access';exception when insufficient_privilege then null;end;
  r=public.get_incomplete_post_page('mine','',null,null,1,false);
  if exists(select 1 from jsonb_array_elements(r->'rows') x where (x->>'athlete_id')::bigint<>(select strava_athlete_id from public.members where auth_user_id=user_id)) then raise exception 'Own reports leaked another author'; end if;
 end if;
 perform set_config('request.jwt.claim.sub','',true);
 begin perform public.get_review_activity_page();raise exception 'Anonymous reviewer access';exception when insufficient_privilege then null;end;
 begin perform public.get_incomplete_post_page();raise exception 'Anonymous reports access';exception when insufficient_privilege then null;end;
 if has_function_privilege('anon','public.get_review_activity_page(text,text,smallint,integer,boolean)','EXECUTE') or has_function_privilege('anon','public.get_incomplete_post_page(text,text,smallint,smallint,integer,boolean)','EXECUTE') then raise exception 'Anonymous RPC grant'; end if;
end $$;
rollback;
select 'Activity pagination, counts, ordering and access checks passed' as result;
