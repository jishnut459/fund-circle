-- ============================================================
-- Fund Circle — Consolidated Seed
-- ============================================================

-- ========================================
-- Phase 1: Drop everything (clean slate)
-- ========================================

drop view if exists contributions_with_status cascade;
drop table if exists contribution_payments cascade;
drop table if exists contributions cascade;
drop table if exists contribution_cycles cascade;
drop table if exists fund_circle_members cascade;
drop table if exists org_invites cascade;
drop table if exists audit_logs cascade;
drop table if exists fund_circles cascade;
drop table if exists organization_members cascade;
drop table if exists organizations cascade;
drop table if exists profiles cascade;
drop table if exists otp_rate_limit cascade;

-- ========================================
-- Phase 2: Create all tables
-- ========================================

create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  name text,
  avatar_url text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table fund_circles (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  contribution_amount numeric(12,2) not null,
  contribution_frequency text not null default 'monthly'
    check (contribution_frequency in ('monthly','every_15_days','every_30_days','every_45_days')),
  subscription_plan text not null default 'free'
    check (subscription_plan in ('free','pro','premium')),
  max_members int not null default 20,
  status text not null default 'active' check (status in ('active','paused','closed')),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table fund_circle_members (
  id uuid primary key default gen_random_uuid(),
  fund_circle_id uuid not null references fund_circles(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member' check (role in ('owner','admin','member')),
  joined_at timestamptz default now(),
  active boolean default true,
  unique (fund_circle_id, user_id)
);

create table contribution_cycles (
  id uuid primary key default gen_random_uuid(),
  fund_circle_id uuid not null references fund_circles(id) on delete cascade,
  label text not null,
  cycle_start date not null,
  cycle_end date not null,
  status text not null default 'open' check (status in ('open','closed')),
  created_at timestamptz default now()
);

create table contributions (
  id uuid primary key default gen_random_uuid(),
  contribution_cycle_id uuid not null references contribution_cycles(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  expected_amount numeric(12,2) not null,
  paid_amount numeric(12,2) not null default 0,
  payment_date date,
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (contribution_cycle_id, user_id)
);

create table contribution_payments (
  id uuid primary key default gen_random_uuid(),
  contribution_id uuid not null references contributions(id) on delete cascade,
  amount numeric(12,2) not null,
  payment_date date not null default current_date,
  recorded_by uuid not null references auth.users(id),
  notes text,
  created_at timestamptz default now()
);

create table audit_logs (
  id uuid primary key default gen_random_uuid(),
  circle_id uuid references fund_circles(id) on delete set null,
  user_id uuid not null references auth.users(id),
  action text not null,
  entity_type text not null,
  entity_id uuid,
  previous_value jsonb,
  new_value jsonb,
  created_at timestamptz default now()
);

create table org_invites (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  role text not null check (role in ('owner','admin','member')),
  fund_circle_id uuid references fund_circles(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','accepted','revoked')),
  created_at timestamptz default now(),
  accepted_at timestamptz
);

create table otp_rate_limit (
  phone text primary key,
  attempts int default 0,
  last_attempt timestamptz default now()
);

-- ========================================
-- Phase 3: Enable RLS on all tables
-- ========================================

alter table profiles enable row level security;
alter table fund_circles enable row level security;
alter table fund_circle_members enable row level security;
alter table contribution_cycles enable row level security;
alter table contributions enable row level security;
alter table contribution_payments enable row level security;
alter table audit_logs enable row level security;
alter table org_invites enable row level security;
alter table otp_rate_limit enable row level security;

-- ========================================
-- Phase 4: Create all RLS policies
-- ========================================

-- --- profiles ---
create policy "Users can view their own profile"
  on profiles for select using (auth.uid() = id);
create policy "Users can update their own profile"
  on profiles for update using (auth.uid() = id);

-- --- fund_circles ---
create policy "fc_select_member" on fund_circles for select
  using (exists (
    select 1 from fund_circle_members fcm
    where fcm.fund_circle_id = fund_circles.id and fcm.user_id = auth.uid()
  ));
create policy "fc_insert_authenticated" on fund_circles for insert
  with check (auth.uid() is not null);
create policy "fc_update_admin_or_owner" on fund_circles for update
  using (exists (
    select 1 from fund_circle_members fcm
    where fcm.fund_circle_id = fund_circles.id and fcm.user_id = auth.uid()
      and fcm.role in ('owner','admin')
  ));
create policy "fc_delete_admin_or_owner" on fund_circles for delete
  using (exists (
    select 1 from fund_circle_members fcm
    where fcm.fund_circle_id = fund_circles.id and fcm.user_id = auth.uid()
      and fcm.role in ('owner','admin')
  ));

-- --- fund_circle_members ---
create policy "fcm_select_member" on fund_circle_members for select
  using (exists (
    select 1 from fund_circle_members fcm2
    where fcm2.fund_circle_id = fund_circle_members.fund_circle_id
      and fcm2.user_id = auth.uid()
  ));
create policy "fcm_insert_admin_or_owner" on fund_circle_members for insert
  with check (exists (
    select 1 from fund_circle_members fcm2
    where fcm2.fund_circle_id = fund_circle_members.fund_circle_id
      and fcm2.user_id = auth.uid()
      and fcm2.role in ('owner','admin')
  ));
create policy "fcm_update_admin_or_owner" on fund_circle_members for update
  using (exists (
    select 1 from fund_circle_members fcm2
    where fcm2.fund_circle_id = fund_circle_members.fund_circle_id
      and fcm2.user_id = auth.uid()
      and fcm2.role in ('owner','admin')
  ));
create policy "fcm_delete_admin_or_owner" on fund_circle_members for delete
  using (exists (
    select 1 from fund_circle_members fcm2
    where fcm2.fund_circle_id = fund_circle_members.fund_circle_id
      and fcm2.user_id = auth.uid()
      and fcm2.role in ('owner','admin')
  ));

-- --- contribution_cycles ---
create policy "cc_select_member" on contribution_cycles for select
  using (exists (
    select 1 from fund_circle_members fcm
    where fcm.fund_circle_id = contribution_cycles.fund_circle_id
      and fcm.user_id = auth.uid()
  ));
create policy "cc_insert_admin_or_owner" on contribution_cycles for insert
  with check (exists (
    select 1 from fund_circle_members fcm
    where fcm.fund_circle_id = contribution_cycles.fund_circle_id
      and fcm.user_id = auth.uid()
      and fcm.role in ('owner','admin')
  ));
create policy "cc_update_admin_or_owner" on contribution_cycles for update
  using (exists (
    select 1 from fund_circle_members fcm
    where fcm.fund_circle_id = contribution_cycles.fund_circle_id
      and fcm.user_id = auth.uid()
      and fcm.role in ('owner','admin')
  ));

-- --- contributions ---
create policy "contrib_select_member" on contributions for select
  using (exists (
    select 1 from contribution_cycles cc
    join fund_circle_members fcm on fcm.fund_circle_id = cc.fund_circle_id
    where cc.id = contributions.contribution_cycle_id
      and fcm.user_id = auth.uid()
  ));
create policy "contrib_update_admin_or_owner" on contributions for update
  using (exists (
    select 1 from contribution_cycles cc
    join fund_circle_members fcm on fcm.fund_circle_id = cc.fund_circle_id
    where cc.id = contributions.contribution_cycle_id
      and fcm.user_id = auth.uid()
      and fcm.role in ('owner','admin')
  ));

-- --- contribution_payments ---
create policy "cp_select_member" on contribution_payments for select
  using (exists (
    select 1 from contributions c
    join contribution_cycles cc on cc.id = c.contribution_cycle_id
    join fund_circle_members fcm on fcm.fund_circle_id = cc.fund_circle_id
    where c.id = contribution_payments.contribution_id
      and fcm.user_id = auth.uid()
  ));
create policy "cp_insert_admin_or_owner" on contribution_payments for insert
  with check (exists (
    select 1 from contributions c
    join contribution_cycles cc on cc.id = c.contribution_cycle_id
    join fund_circle_members fcm on fcm.fund_circle_id = cc.fund_circle_id
    where c.id = contribution_payments.contribution_id
      and fcm.user_id = auth.uid()
      and fcm.role in ('owner','admin')
  ));

-- --- audit_logs ---
create policy "audit_select_admin_or_owner" on audit_logs for select
  using (exists (
    select 1 from fund_circle_members fcm
    where fcm.fund_circle_id = audit_logs.circle_id
      and fcm.user_id = auth.uid()
      and fcm.role in ('owner','admin')
  ));

-- --- org_invites ---
create policy "invite_select_admin_or_owner" on org_invites for select
  using (exists (
    select 1 from fund_circle_members fcm
    where fcm.fund_circle_id = org_invites.fund_circle_id
      and fcm.user_id = auth.uid()
      and fcm.role in ('owner','admin')
  ));
create policy "invite_insert_admin_or_owner" on org_invites for insert
  with check (exists (
    select 1 from fund_circle_members fcm
    where fcm.fund_circle_id = org_invites.fund_circle_id
      and fcm.user_id = auth.uid()
      and fcm.role in ('owner','admin')
  ));
create policy "invite_update_admin_or_owner" on org_invites for update
  using (exists (
    select 1 from fund_circle_members fcm
    where fcm.fund_circle_id = org_invites.fund_circle_id
      and fcm.user_id = auth.uid()
      and fcm.role in ('owner','admin')
  ));

-- ========================================
-- Phase 5: Views
-- ========================================

create or replace view contributions_with_status as
select
  c.*,
  case
    when c.paid_amount = 0 then 'unpaid'
    when c.paid_amount < c.expected_amount then 'partially_paid'
    when c.paid_amount = c.expected_amount then 'paid'
    else 'overpaid'
  end as status
from contributions c;
