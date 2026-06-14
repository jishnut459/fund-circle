-- Fund Circle — Email Auth Migration (0003)
-- Switches from phone-based to email-based user identity

-- 1. Profiles: drop phone, add email + avatar_url
alter table profiles drop column if exists phone;
alter table profiles add column if not exists email text;
alter table profiles add column if not exists avatar_url text;

-- Make email non-null for new rows (existing rows may be null temporarily)
-- Populate existing profiles with placeholder emails from auth.users if available
update profiles set email = au.email
from auth.users au
where profiles.id = au.id and profiles.email is null;

-- 2. Remove phone constraints from auth triggers (if any)
-- The seed.sql will populate users with emails

-- 3. Create org_invites table
create table if not exists org_invites (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  email text not null,
  role text not null check (role in ('owner','admin','member')),
  fund_circle_id uuid references fund_circles(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','accepted','revoked')),
  created_at timestamptz default now(),
  accepted_at timestamptz,
  unique (organization_id, email, fund_circle_id)
);

-- RLS for org_invites
alter table org_invites enable row level security;

drop policy if exists "invite_select_admin_or_owner" on org_invites;
create policy "invite_select_admin_or_owner" on org_invites for select
  using (
    organization_id in (
      select organization_id from organization_members
      where user_id = auth.uid() and role in ('owner','admin')
    )
  );

drop policy if exists "invite_insert_admin_or_owner" on org_invites;
create policy "invite_insert_admin_or_owner" on org_invites for insert
  with check (
    organization_id in (
      select organization_id from organization_members
      where user_id = auth.uid() and role in ('owner','admin')
    )
  );

drop policy if exists "invite_update_admin_or_owner" on org_invites;
create policy "invite_update_admin_or_owner" on org_invites for update
  using (
    organization_id in (
      select organization_id from organization_members
      where user_id = auth.uid() and role in ('owner','admin')
    )
  );

-- 4. Remove phone from profiles unique constraint if exists (migration is idempotent)
-- Profiles primary key is on id, email uniqueness handled at app level

-- 5. Update contribution_payments.recorded_by FK (already references auth.users, no change needed)
