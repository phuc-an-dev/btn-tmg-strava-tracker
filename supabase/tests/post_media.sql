begin;
update private.extension_sync_config set secret_hash=encode(extensions.digest(repeat('k',32),'sha256'),'hex'),requests=0;
insert into public.club_activities(activity_id,athlete_id,athlete_name,name,sport_type,start_local,source)
values(900000000000011,900000000000012,'Activity owner','Walk','Walk','2026-10-14T07:00:00','{"source_posts":[{"post_id":"900000000000013"}]}');
do $$ declare payload jsonb; observed timestamptz=now(); r jsonb; baseline_points bigint; begin
 select coalesce(sum(points),0) into baseline_points from public.club_activities;
 payload=jsonb_build_object('club_id','2368312','posts',jsonb_build_array(jsonb_build_object('post_id','900000000000013','athlete_id','900000000000014','athlete_name','Post author','title','Test share','posted_at','2026-10-14T15:00:00Z','activity_ids',jsonb_build_array('900000000000011'),'kudos_count',3,'kudos_observed_at',observed)));
 perform public.import_extension_posts(payload,repeat('k',32));perform public.import_extension_posts(payload,repeat('k',32));
 if (select count(*) from public.club_discussion_posts where post_id=900000000000013)<>1 then raise exception 'Duplicate post'; end if;
 payload=jsonb_set(payload,'{posts,0,kudos_count}','8');payload=jsonb_set(payload,'{posts,0,kudos_observed_at}',to_jsonb(observed+interval '1 second'));
 perform public.import_extension_posts(payload,repeat('k',32));
 payload=jsonb_set(payload,'{posts,0,kudos_count}','2');payload=jsonb_set(payload,'{posts,0,kudos_observed_at}',to_jsonb(observed-interval '1 minute'));
 perform public.import_extension_posts(payload,repeat('k',32));
 if (select kudos_count from public.club_discussion_posts where post_id=900000000000013)<>8 then raise exception 'Older snapshot overwrote new count'; end if;
 perform set_config('request.jwt.claim.sub',(select id::text from public.profiles limit 1),true);
 r=public.get_kudos_rankings('event');
 if not exists(select 1 from jsonb_array_elements(r->'individuals') e where e->>'athlete_id'='900000000000014' and (e->>'kudos')::int=8) then raise exception 'Kudos not attributed to post author'; end if;
 if exists(select 1 from jsonb_array_elements(r->'individuals') e where e->>'athlete_id'='900000000000012') then raise exception 'Kudos attributed to activity owner'; end if;
 payload=jsonb_set(payload,'{posts,0,kudos_count}','0');payload=jsonb_set(payload,'{posts,0,kudos_observed_at}',to_jsonb(observed+interval '2 seconds'));perform public.import_extension_posts(payload,repeat('k',32));
 if (select kudos_count from public.club_discussion_posts where post_id=900000000000013)<>0 then raise exception 'Zero count ignored'; end if;
 if (select coalesce(sum(points),0) from public.club_activities)<>baseline_points then raise exception 'Kudos changed competition points'; end if;
 if has_table_privilege('authenticated','public.club_discussion_posts','UPDATE') or has_function_privilege('anon','public.get_kudos_rankings(text)','EXECUTE') then raise exception 'Invalid access grants'; end if;
end $$;
do $$ declare payload jsonb; photo jsonb; observed timestamptz=now(); r jsonb; begin
 photo='[{"id":"image-1","url":"https://dgtzuqphqg23d.cloudfront.net/test.jpg","thumbnail_url":"https://dgtzuqphqg23d.cloudfront.net/thumb.jpg","caption":"Test image"}]'::jsonb;
 payload=jsonb_build_object('club_id','2368312','posts',jsonb_build_array(jsonb_build_object('post_id','900000000000013','athlete_id','900000000000014','athlete_name','Post author','title','Test share','posted_at','2026-10-14T15:00:00Z','activity_ids',jsonb_build_array('900000000000011'),'kudos_count',999999,'kudos_observed_at',observed+interval '3 seconds','media',photo)));
 perform public.import_extension_posts(payload,repeat('k',32));
 if (select media from public.club_discussion_posts where post_id=900000000000013)<>photo then raise exception 'Media not stored'; end if;
 r=public.get_kudos_rankings('event');
 if r->'featured'->0->'media'<>'[]'::jsonb then raise exception 'Post media incorrectly used for activity'; end if;
 payload=payload#-'{posts,0,media}';perform public.import_extension_posts(payload,repeat('k',32));
 if (select media from public.club_discussion_posts where post_id=900000000000013)<>photo then raise exception 'Legacy import erased media'; end if;
 payload=jsonb_set(payload,'{posts,0,media}','[]');payload=jsonb_set(payload,'{posts,0,kudos_observed_at}',to_jsonb(observed-interval '1 minute'));perform public.import_extension_posts(payload,repeat('k',32));
 if (select media from public.club_discussion_posts where post_id=900000000000013)<>photo then raise exception 'Old snapshot erased media'; end if;
 payload=jsonb_set(payload,'{posts,0,kudos_observed_at}',to_jsonb(observed+interval '4 seconds'));perform public.import_extension_posts(payload,repeat('k',32));
 if (select jsonb_array_length(media) from public.club_discussion_posts where post_id=900000000000013)<>0 then raise exception 'Removed photos retained'; end if;
 payload=jsonb_set(payload,'{posts,0,media}',replace(photo::text,'dgtzuqphqg23d.cloudfront.net','example.com')::jsonb);
 begin
  perform public.import_extension_posts(payload,repeat('k',32));raise exception 'Untrusted URL accepted';
 exception when raise_exception then if sqlerrm<>'Invalid media URL' then raise;end if;end;
end $$;
rollback;
