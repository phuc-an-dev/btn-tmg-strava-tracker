begin;
update private.extension_sync_config set secret_hash=encode(extensions.digest(repeat('t',32),'sha256'),'hex'),requests=0;
select public.import_extension_posts('{"club_id":"2368312","posts":[{"post_id":"900000000000001","athlete_id":"900000000000002","athlete_name":"Test report","title":"LD2-1-4830","posted_at":null,"activity_ids":[]}]}'::jsonb,repeat('t',32));
do $$ begin
 if not exists(select 1 from public.club_incomplete_posts where post_id=900000000000001 and not resolved) then raise exception 'Missing report'; end if;
 if exists(select 1 from public.club_activities where activity_id=900000000000001) then raise exception 'Report became an activity'; end if;
 if has_table_privilege('authenticated','public.club_incomplete_posts','UPDATE') or has_table_privilege('authenticated','public.club_incomplete_posts','INSERT') then raise exception 'Client can write reports'; end if;
end $$;
insert into public.club_activities(activity_id,athlete_id,athlete_name,name,sport_type,start_local,source)
values(900000000000003,900000000000002,'Test report','Activity','Walk','2026-10-13T07:00:00','{"source_posts":[{"post_id":"900000000000001"}]}');
select public.import_extension_posts('{"club_id":"2368312","posts":[{"post_id":"900000000000001","athlete_id":"900000000000002","athlete_name":"Test report","title":"LD2-1-4830","activity_ids":["900000000000003"]}]}'::jsonb,repeat('t',32));
do $$ begin
 if not exists(select 1 from public.club_incomplete_posts where post_id=900000000000001 and resolved) then raise exception 'Fixed report not resolved'; end if;
 if exists(select 1 from public.club_activities where activity_id=900000000000003 and (status<>'pending' or points<>0)) then raise exception 'Sync approved or scored an activity'; end if;
end $$;
rollback;
