-- ============================================================
-- Fund Circle — Consolidated Seed
-- ============================================================
-- WARNING: This wipes the entire database, including every
-- Supabase Auth user (auth.users and its cascaded identities,
-- sessions, refresh tokens, etc.) and all application data.
-- Intended for local/dev resets only — never run against
-- production.
-- ============================================================

-- ========================================
-- Phase 1: Drop everything (clean slate)
-- ========================================
-- Tables are dropped before auth.users is wiped because
-- audit_logs.user_id and contribution_payments.recorded_by
-- reference auth.users(id) without ON DELETE CASCADE/SET NULL,
-- which would otherwise block the delete in Phase 2.

drop view if exists contributions_with_status cascade;
drop view if exists loan_installments_with_status cascade;
drop table if exists circle_settlement_payouts cascade;
drop table if exists circle_settlements cascade;
drop table if exists cycle_asset_records cascade;
drop table if exists loan_payments cascade;
drop table if exists loan_installments cascade;
drop table if exists loans cascade;
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
-- Phase 2: Wipe all auth users
-- (cascades to auth.identities, auth.sessions,
--  auth.refresh_tokens, auth.mfa_factors, etc.)
-- ========================================

delete from auth.users;

-- ========================================
-- Phase 3: Create all tables
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
    check (contribution_frequency in ('daily','weekly','monthly','quarterly')),
  cycle_due_day int check (cycle_due_day is null or cycle_due_day between 1 and 31),
  subscription_plan text not null default 'free'
    check (subscription_plan in ('free','pro','premium')),
  max_members int not null default 20,
  status text not null default 'active' check (status in ('active','paused','closed')),
  asset_allocation_pct numeric(5,2) not null default 0
    check (asset_allocation_pct >= 0 and asset_allocation_pct <= 100),
  loan_allocation_pct numeric(5,2) not null default 100
    check (loan_allocation_pct >= 0 and loan_allocation_pct <= 100),
  loan_interest_rate_pct numeric(5,2) not null default 0
    check (loan_interest_rate_pct >= 0),
  max_loan_pct_of_contribution numeric(5,2) not null default 90
    check (max_loan_pct_of_contribution >= 0),
  max_loan_pct_of_lending_pool numeric(5,2) not null default 10
    check (max_loan_pct_of_lending_pool >= 0),
  contribution_late_fee numeric(12,2) not null default 0
    check (contribution_late_fee >= 0),
  contribution_grace_days int not null default 0
    check (contribution_grace_days >= 0),
  loan_late_fee numeric(12,2) not null default 0
    check (loan_late_fee >= 0),
  loan_grace_days int not null default 0
    check (loan_grace_days >= 0),
  start_date date,
  end_date date,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  constraint fc_allocation_sums_100 check (asset_allocation_pct + loan_allocation_pct = 100),
  constraint fc_dates_valid check (start_date is null or end_date is null or end_date >= start_date)
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
  due_date date not null,
  status text not null default 'open' check (status in ('open','closed')),
  created_at timestamptz default now(),
  unique (fund_circle_id, cycle_start)
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

create table loans (
  id uuid primary key default gen_random_uuid(),
  fund_circle_id uuid not null references fund_circles(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending_request'
    check (status in ('pending_request','rejected','cancelled','active','closed')),
  requested_amount numeric(12,2) not null check (requested_amount > 0),
  requested_term_months int not null check (requested_term_months > 0),
  approved_amount numeric(12,2) check (approved_amount > 0),
  approved_term_months int check (approved_term_months > 0),
  interest_rate_pct numeric(5,2),
  purpose text,
  requested_by uuid not null references auth.users(id),
  reviewed_by uuid references auth.users(id),
  reviewed_at timestamptz,
  issued_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table loan_installments (
  id uuid primary key default gen_random_uuid(),
  loan_id uuid not null references loans(id) on delete cascade,
  installment_number int not null check (installment_number > 0),
  due_date date not null,
  principal_component numeric(12,2) not null check (principal_component >= 0),
  interest_component numeric(12,2) not null check (interest_component >= 0),
  total_due numeric(12,2) not null check (total_due >= 0),
  paid_amount numeric(12,2) not null default 0 check (paid_amount >= 0),
  late_fee_applied numeric(12,2) not null default 0 check (late_fee_applied >= 0),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (loan_id, installment_number)
);

create table loan_payments (
  id uuid primary key default gen_random_uuid(),
  loan_installment_id uuid not null references loan_installments(id) on delete cascade,
  amount numeric(12,2) not null check (amount > 0),
  payment_date date not null default current_date,
  recorded_by uuid not null references auth.users(id),
  notes text,
  created_at timestamptz default now()
);

create table cycle_asset_records (
  id uuid primary key default gen_random_uuid(),
  fund_circle_id uuid not null references fund_circles(id) on delete cascade,
  contribution_cycle_id uuid references contribution_cycles(id) on delete set null,
  asset_type text not null check (asset_type in ('recurring_deposit','fixed_deposit','cash_in_hand','mutual_fund','other')),
  institution text,
  amount numeric(12,2) not null check (amount >= 0),
  current_value numeric(12,2),
  notes text,
  recorded_by uuid not null references auth.users(id),
  recorded_at date not null default current_date,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table circle_settlements (
  id uuid primary key default gen_random_uuid(),
  fund_circle_id uuid not null unique references fund_circles(id) on delete cascade,
  total_value numeric(12,2) not null check (total_value >= 0),
  total_contributions_base numeric(12,2) not null,
  status text not null default 'draft' check (status in ('draft','finalized')),
  calculated_by uuid not null references auth.users(id),
  calculated_at timestamptz default now(),
  finalized_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table circle_settlement_payouts (
  id uuid primary key default gen_random_uuid(),
  circle_settlement_id uuid not null references circle_settlements(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  contribution_total numeric(12,2) not null,
  share_amount numeric(12,2) not null,
  disbursed boolean not null default false,
  disbursed_at timestamptz,
  disbursed_by uuid references auth.users(id),
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (circle_settlement_id, user_id)
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
  invited_name text,
  invited_by uuid references auth.users(id) on delete set null,
  created_at timestamptz default now(),
  accepted_at timestamptz
);

create unique index org_invites_pending_unique on org_invites (fund_circle_id, lower(email)) where status = 'pending';

create table otp_rate_limit (
  phone text primary key,
  attempts int default 0,
  last_attempt timestamptz default now()
);

-- ========================================
-- Phase 4: Enable RLS on all tables
-- ========================================

alter table profiles enable row level security;
alter table fund_circles enable row level security;
alter table fund_circle_members enable row level security;
alter table contribution_cycles enable row level security;
alter table contributions enable row level security;
alter table contribution_payments enable row level security;
alter table loans enable row level security;
alter table loan_installments enable row level security;
alter table loan_payments enable row level security;
alter table cycle_asset_records enable row level security;
alter table circle_settlements enable row level security;
alter table circle_settlement_payouts enable row level security;
alter table audit_logs enable row level security;
alter table org_invites enable row level security;
alter table otp_rate_limit enable row level security;

-- ========================================
-- Phase 5: Create all RLS policies
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

-- --- loans ---
create policy "loans_select_member" on loans for select
  using (
    user_id = auth.uid()
    or exists (
      select 1 from fund_circle_members fcm
      where fcm.fund_circle_id = loans.fund_circle_id
        and fcm.user_id = auth.uid()
        and fcm.role in ('owner','admin')
    )
  );
create policy "loans_insert_member" on loans for insert
  with check (
    user_id = auth.uid()
    and requested_by = auth.uid()
    and exists (
      select 1 from fund_circle_members fcm
      where fcm.fund_circle_id = loans.fund_circle_id
        and fcm.user_id = auth.uid()
        and fcm.active = true
    )
  );
create policy "loans_update_admin_or_owner" on loans for update
  using (exists (
    select 1 from fund_circle_members fcm
    where fcm.fund_circle_id = loans.fund_circle_id
      and fcm.user_id = auth.uid()
      and fcm.role in ('owner','admin')
  ));

-- --- loan_installments ---
create policy "loan_installments_select_member" on loan_installments for select
  using (exists (
    select 1 from loans l
    join fund_circle_members fcm on fcm.fund_circle_id = l.fund_circle_id
    where l.id = loan_installments.loan_id
      and fcm.user_id = auth.uid()
      and (l.user_id = auth.uid() or fcm.role in ('owner','admin'))
  ));
create policy "loan_installments_update_admin_or_owner" on loan_installments for update
  using (exists (
    select 1 from loans l
    join fund_circle_members fcm on fcm.fund_circle_id = l.fund_circle_id
    where l.id = loan_installments.loan_id
      and fcm.user_id = auth.uid()
      and fcm.role in ('owner','admin')
  ));

-- --- loan_payments ---
create policy "loan_payments_select_member" on loan_payments for select
  using (exists (
    select 1 from loan_installments li
    join loans l on l.id = li.loan_id
    join fund_circle_members fcm on fcm.fund_circle_id = l.fund_circle_id
    where li.id = loan_payments.loan_installment_id
      and fcm.user_id = auth.uid()
      and (l.user_id = auth.uid() or fcm.role in ('owner','admin'))
  ));
create policy "loan_payments_insert_admin_or_owner" on loan_payments for insert
  with check (exists (
    select 1 from loan_installments li
    join loans l on l.id = li.loan_id
    join fund_circle_members fcm on fcm.fund_circle_id = l.fund_circle_id
    where li.id = loan_payments.loan_installment_id
      and fcm.user_id = auth.uid()
      and fcm.role in ('owner','admin')
  ));

-- --- cycle_asset_records ---
create policy "car_select_member" on cycle_asset_records for select
  using (exists (
    select 1 from fund_circle_members fcm
    where fcm.fund_circle_id = cycle_asset_records.fund_circle_id
      and fcm.user_id = auth.uid()
      and fcm.active = true
  ));
create policy "car_insert_admin_or_owner" on cycle_asset_records for insert
  with check (exists (
    select 1 from fund_circle_members fcm
    where fcm.fund_circle_id = cycle_asset_records.fund_circle_id
      and fcm.user_id = auth.uid()
      and fcm.role in ('owner','admin')
  ));
create policy "car_update_admin_or_owner" on cycle_asset_records for update
  using (exists (
    select 1 from fund_circle_members fcm
    where fcm.fund_circle_id = cycle_asset_records.fund_circle_id
      and fcm.user_id = auth.uid()
      and fcm.role in ('owner','admin')
  ));

-- --- circle_settlements ---
create policy "cs_select_member" on circle_settlements for select
  using (exists (
    select 1 from fund_circle_members fcm
    where fcm.fund_circle_id = circle_settlements.fund_circle_id
      and fcm.user_id = auth.uid()
      and fcm.active = true
  ));
create policy "cs_insert_admin_or_owner" on circle_settlements for insert
  with check (exists (
    select 1 from fund_circle_members fcm
    where fcm.fund_circle_id = circle_settlements.fund_circle_id
      and fcm.user_id = auth.uid()
      and fcm.role in ('owner','admin')
  ));
create policy "cs_update_admin_or_owner" on circle_settlements for update
  using (exists (
    select 1 from fund_circle_members fcm
    where fcm.fund_circle_id = circle_settlements.fund_circle_id
      and fcm.user_id = auth.uid()
      and fcm.role in ('owner','admin')
  ));

-- --- circle_settlement_payouts ---
create policy "csp_select_member" on circle_settlement_payouts for select
  using (
    user_id = auth.uid()
    or exists (
      select 1 from circle_settlements cs
      join fund_circle_members fcm on fcm.fund_circle_id = cs.fund_circle_id
      where cs.id = circle_settlement_payouts.circle_settlement_id
        and fcm.user_id = auth.uid()
        and fcm.role in ('owner','admin')
    )
  );
create policy "csp_insert_admin_or_owner" on circle_settlement_payouts for insert
  with check (exists (
    select 1 from circle_settlements cs
    join fund_circle_members fcm on fcm.fund_circle_id = cs.fund_circle_id
    where cs.id = circle_settlement_payouts.circle_settlement_id
      and fcm.user_id = auth.uid()
      and fcm.role in ('owner','admin')
  ));
create policy "csp_update_admin_or_owner" on circle_settlement_payouts for update
  using (exists (
    select 1 from circle_settlements cs
    join fund_circle_members fcm on fcm.fund_circle_id = cs.fund_circle_id
    where cs.id = circle_settlement_payouts.circle_settlement_id
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
-- Phase 6: Views
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

create or replace view loan_installments_with_status as
select li.*,
  case
    when li.paid_amount >= li.total_due then 'paid'
    when li.paid_amount > 0 and current_date > li.due_date then 'overdue'
    when li.paid_amount > 0 then 'partially_paid'
    when current_date > li.due_date then 'overdue'
    else 'pending'
  end as status
from loan_installments li;
