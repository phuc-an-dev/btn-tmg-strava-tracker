alter table public.profiles
  add column if not exists full_name text,
  add column if not exists birth_year smallint,
  add column if not exists gender text check (gender in ('male', 'female') or gender is null);

create or replace function public.handle_signup() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, email, full_name, birth_year, gender)
  values (
    new.id,
    coalesce(new.email, ''),
    nullif(trim(coalesce(new.raw_user_meta_data ->> 'full_name', '')), ''),
    nullif(new.raw_user_meta_data ->> 'birth_year', '')::smallint,
    nullif(new.raw_user_meta_data ->> 'gender', '')
  )
  on conflict (id) do update set
    email = excluded.email,
    full_name = coalesce(excluded.full_name, public.profiles.full_name),
    birth_year = coalesce(excluded.birth_year, public.profiles.birth_year),
    gender = coalesce(excluded.gender, public.profiles.gender);
  return new;
end;
$$;
