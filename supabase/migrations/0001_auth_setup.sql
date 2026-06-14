-- Migrate old profiles table: drop firebase_uid column (no longer needed with Supabase Auth)
do $$
begin
  if exists (select 1 from information_schema.columns where table_name = 'profiles' and column_name = 'firebase_uid') then
    alter table profiles drop column firebase_uid;
  end if;
end $$;

-- Profiles table, linked 1:1 with Supabase auth.users via id
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  phone text unique not null,
  name text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table profiles enable row level security;

drop policy if exists "Users can view their own profile" on profiles;
create policy "Users can view their own profile"
  on profiles for select
  using (auth.uid() = id);

drop policy if exists "Users can update their own profile" on profiles;
create policy "Users can update their own profile"
  on profiles for update
  using (auth.uid() = id);

-- OTP rate limiting table (service-role only, no client policies)
create table if not exists otp_rate_limit (
  phone text primary key,
  attempts int default 0,
  last_attempt timestamptz default now()
);

alter table otp_rate_limit enable row level security;
-- No policies — service role bypasses RLS, no client access permitted
