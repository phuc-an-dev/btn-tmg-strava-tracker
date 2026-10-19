-- Performance indexes for club_activities queries and get_member_activities RPC
create index if not exists idx_club_activities_athlete_status_date 
  on public.club_activities (athlete_id, status, start_local desc);

create index if not exists idx_club_activities_division_status_date 
  on public.club_activities (division_id, status, start_local desc);

create index if not exists idx_club_activities_date_id 
  on public.club_activities (start_local desc, activity_id desc);
