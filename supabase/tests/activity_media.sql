begin;
update private.extension_sync_config set secret_hash=encode(extensions.digest(repeat('m',32),'sha256'),'hex'),requests=0;
-- Clone an approved fixture so media refresh is verified against review data.
insert into public.club_activities(activity_id,athlete_id,athlete_name,name,sport_type,start_local,steps,people_count,division_id,group_id,status,note,source,revision,reviewed_by,reviewed_at)
select 900000000000021,900000000000022,'Activity author','Media fixture',sport_type,start_local,steps,people_count,division_id,group_id,status,'Keep this review','{}',revision,reviewed_by,reviewed_at from public.club_activities where status='approved' limit 1;
do $$ declare payload jsonb; photo jsonb; before_row jsonb; after_row jsonb; observed timestamptz=now(); ranked jsonb; begin
 select to_jsonb(a) into before_row from public.club_activities a where activity_id=900000000000021;
 if before_row is null then raise exception 'Approved fixture missing'; end if;
 photo='[{"id":"activity-photo","url":"https://dgtzuqphqg23d.cloudfront.net/activity.jpg","thumbnail_url":"https://dgtzuqphqg23d.cloudfront.net/activity.jpg","caption":"Activity photo"}]'::jsonb;
 payload=jsonb_build_object('club_id','2368312','activities',jsonb_build_array(jsonb_build_object('activity_id','900000000000021','athlete_id','900000000000022','athlete_name','Changed author','name','Changed title','sport_type','Walk','start_local','2026-10-14T09:00:00','steps',999999,'people_count',99,'status','rejected','note','Discard this','media',photo,'media_observed_at',observed)));
 perform public.import_extension_activities(payload,repeat('m',32));
 select to_jsonb(a) into after_row from public.club_activities a where activity_id=900000000000021;
 if after_row->'media'<>photo or (before_row-'media'-'media_observed_at')<>(after_row-'media'-'media_observed_at') then raise exception 'Media refresh changed reviewed data'; end if;
 payload=payload#-'{activities,0,media}';perform public.import_extension_activities(payload,repeat('m',32));
 if (select media from public.club_activities where activity_id=900000000000021)<>photo then raise exception 'Legacy import erased images'; end if;
 payload=jsonb_set(payload,'{activities,0,media}','[]');payload=jsonb_set(payload,'{activities,0,media_observed_at}',to_jsonb(observed-interval '1 minute'));perform public.import_extension_activities(payload,repeat('m',32));
 if (select media from public.club_activities where activity_id=900000000000021)<>photo then raise exception 'Older snapshot erased images'; end if;
 payload=jsonb_set(payload,'{activities,0,media_observed_at}',to_jsonb(observed+interval '1 second'));perform public.import_extension_activities(payload,repeat('m',32));
 if (select media from public.club_activities where activity_id=900000000000021)<>'[]'::jsonb then raise exception 'Image removal not synchronized'; end if;
 payload=jsonb_set(payload,'{activities,0,media}',photo);payload=jsonb_set(payload,'{activities,0,media_observed_at}',to_jsonb(observed+interval '2 seconds'));perform public.import_extension_activities(payload,repeat('m',32));
 insert into public.club_discussion_posts(post_id,athlete_id,athlete_name,title,posted_at,activity_ids,kudos_count,kudos_observed_at,media)
 values(900000000000023,900000000000024,'Post author','Media fixture',now(),array[900000000000021::bigint],999999,observed,'[{"id":"post-photo","url":"https://dgtzuqphqg23d.cloudfront.net/post.jpg","thumbnail_url":"https://dgtzuqphqg23d.cloudfront.net/post.jpg","caption":"Post photo"}]');
 perform set_config('request.jwt.claim.sub',(select id::text from public.profiles limit 1),true);
 ranked=public.get_kudos_rankings('event');
 if ranked->'featured'->0->'media'<>photo then raise exception 'Rankings used post media instead of activity media'; end if;
 payload=jsonb_set(payload,'{activities,0,media}',replace(photo::text,'dgtzuqphqg23d.cloudfront.net','example.com')::jsonb);
 begin perform public.import_extension_activities(payload,repeat('m',32));raise exception 'Bad origin accepted';
 exception when raise_exception then if sqlerrm<>'Invalid media URL' then raise;end if;end;
end $$;
rollback;
