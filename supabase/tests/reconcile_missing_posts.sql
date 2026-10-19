begin;
update private.extension_sync_config set secret_hash=encode(extensions.digest(repeat('r',32),'sha256'),'hex'),requests=0;
insert into public.club_incomplete_posts(post_id,athlete_id,athlete_name,title,resolved,updated_at) values
 (900000000000081,900000000000089,'Fixture','Deleted report',false,now()-interval '1 day'),
 (900000000000082,900000000000089,'Fixture','Still visible',false,now()-interval '1 day'),
 (900000000000083,900000000000089,'Fixture','Resolved report',true,now()-interval '1 day'),
 (900000000000084,900000000000089,'Fixture','Seen during newer upload',false,now());
do $$
declare payload jsonb; result jsonb; activities_before text; kudos_before text; first_start timestamptz=now()-interval '2 minutes';
begin
 select md5(coalesce(jsonb_agg(to_jsonb(a) order by activity_id)::text,'')) into activities_before from public.club_activities a;
 select md5(coalesce(jsonb_agg(to_jsonb(p) order by post_id)::text,'')) into kudos_before from public.club_discussion_posts p;
 payload=jsonb_build_object('club_id','2368312','complete',true,'pages',2,'started_at',first_start,'completed_at',now()-interval '1 minute','post_ids',jsonb_build_array('900000000000082'));
 begin
  perform public.complete_extension_post_scan(payload,repeat('x',32));raise exception 'Wrong secret accepted';
 exception when insufficient_privilege then null; end;
 begin
  perform public.complete_extension_post_scan(jsonb_set(payload,'{complete}','false'),repeat('r',32));raise exception 'Partial scan accepted';
 exception when raise_exception then if sqlerrm<>'Invalid complete scan' then raise;end if;end;
 begin
  perform public.complete_extension_post_scan(jsonb_set(payload,'{post_ids}','[null]'),repeat('r',32));raise exception 'Bad ID accepted';
 exception when raise_exception then if sqlerrm<>'Invalid post ID' then raise;end if;end;
 result=public.complete_extension_post_scan(payload,repeat('r',32));
 if (select missing_since is null from public.club_incomplete_posts where post_id=900000000000081) then raise exception 'Deleted report still visible';end if;
 if exists(select 1 from public.club_incomplete_posts where post_id in(900000000000082,900000000000083,900000000000084) and missing_since is not null) then raise exception 'Visible, resolved, or newer report hidden';end if;
 if not exists(select 1 from private.extension_post_scans where started_at=first_start and 900000000000081=any(hidden_post_ids)) then raise exception 'Missing archive history';end if;
 if (select resolved from public.club_incomplete_posts where post_id=900000000000081) then raise exception 'Archiving changed resolution';end if;
 result=public.complete_extension_post_scan(payload,repeat('r',32));
 if result->'already_completed' is distinct from 'true'::jsonb then raise exception 'Retry not idempotent';end if;
 perform set_config('request.jwt.claim.sub',(select id::text from public.profiles where role='admin' limit 1),true);
 if auth.uid() is null then raise exception 'Test requires admin fixture';end if;
 if exists(select 1 from jsonb_array_elements(public.get_incomplete_posts('club')) e where e->>'post_id'='900000000000081') then raise exception 'Legacy reader returned hidden report';end if;
 result=public.get_incomplete_post_page('club','Deleted report');
 if (result->>'total')::integer<>0 then raise exception 'Paged reader counts hidden report';end if;
 payload=jsonb_set(payload,'{started_at}',to_jsonb(now()-interval '50 seconds'));
 payload=jsonb_set(payload,'{completed_at}',to_jsonb(now()-interval '40 seconds'));
 payload=jsonb_set(payload,'{post_ids}','["900000000000081","900000000000082"]');
 result=public.complete_extension_post_scan(payload,repeat('r',32));
 if (select missing_since is not null from public.club_incomplete_posts where post_id=900000000000081) then raise exception 'Reappearing report not restored';end if;
 result=public.get_incomplete_post_page('club','Deleted report');
 if (result->>'total')::integer<>1 then raise exception 'Restored report not returned';end if;
 payload=jsonb_set(payload,'{started_at}',to_jsonb(now()-interval '3 minutes'));
 payload=jsonb_set(payload,'{post_ids}','[]');
 result=public.complete_extension_post_scan(payload,repeat('r',32));
 if result->'stale' is distinct from 'true'::jsonb or (select missing_since is not null from public.club_incomplete_posts where post_id=900000000000081) then raise exception 'Old snapshot overrode new scan';end if;
 payload=jsonb_set(payload,'{started_at}',to_jsonb(now()-interval '30 seconds'));
 payload=jsonb_set(payload,'{completed_at}',to_jsonb(now()-interval '20 seconds'));
 result=public.complete_extension_post_scan(payload,repeat('r',32));
 if (select missing_since is null from public.club_incomplete_posts where post_id=900000000000082) then raise exception 'Empty completed feed did not archive old reports';end if;
 if activities_before is distinct from (select md5(coalesce(jsonb_agg(to_jsonb(a) order by activity_id)::text,'')) from public.club_activities a) then raise exception 'Activities changed';end if;
 if kudos_before is distinct from (select md5(coalesce(jsonb_agg(to_jsonb(p) order by post_id)::text,'')) from public.club_discussion_posts p) then raise exception 'Kudos changed';end if;
 if has_table_privilege('authenticated','private.extension_post_scans','SELECT') then raise exception 'Scan history exposed';end if;
end $$;
rollback;
