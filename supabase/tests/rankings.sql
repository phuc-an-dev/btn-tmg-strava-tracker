begin;
select set_config('request.jwt.claim.sub',(select id::text from public.profiles limit 1),true);
do $$ declare r jsonb; expected_steps bigint; expected_count bigint; begin
 r=public.get_rankings('event');
 select coalesce(sum(steps),0),count(*) into expected_steps,expected_count from public.club_activities where status='approved' and sport_type='Walk' and start_local>='2026-10-04' and start_local<'2026-11-16';
 if (r->'summary'->>'steps')::bigint<>expected_steps or (r->'summary'->>'activities')::bigint<>expected_count then raise exception 'Unapproved or excluded activity affected rankings'; end if;
 if exists(select 1 from jsonb_array_elements(r->'individuals') e where e ? 'email' or e ? 'note' or e ? 'source' or e ? 'birth_year') then raise exception 'Private fields leaked'; end if;
 if (select coalesce(sum((e->>'steps')::bigint),0) from jsonb_array_elements(r->'individuals') e)<>expected_steps then raise exception 'Individual sum differs'; end if;
 if exists(select 1 from jsonb_array_elements(r->'groups') e where (e->>'participants')::int>(e->>'members')::int) then raise exception 'Participation exceeds roster'; end if;
 if has_function_privilege('anon','public.get_rankings(text)','EXECUTE') then raise exception 'Anonymous rankings access'; end if;
 perform public.get_rankings('week');
end $$;
rollback;
