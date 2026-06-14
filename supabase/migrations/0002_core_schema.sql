-- ============================================================
-- Fund Circle — Core Application Schema (Migration 0002)
-- ============================================================

-- --------------------------------------------------
-- Phase 1: Create all tables
-- --------------------------------------------------

create table if not exists organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  subscription_plan text not null default 'free' check (subscription_plan in ('free','pro','premium')),
  status text not null default 'active' check (status in ('active','suspended')),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists organization_members (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('owner','admin','member')),
  created_at timestamptz default now(),
  unique (organization_id, user_id)
);

create table if not exists fund_circles (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  name text not null,
  description text,
  contribution_amount numeric(12,2) not null,
  contribution_frequency text not null default 'monthly'
    check (contribution_frequency in ('monthly','every_15_days','every_30_days','every_45_days')),
  status text not null default 'active' check (status in ('active','paused','closed')),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists fund_circle_members (
  id uuid primary key default gen_random_uuid(),
  fund_circle_id uuid not null references fund_circles(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  joined_at timestamptz default now(),
  active boolean default true,
  unique (fund_circle_id, user_id)
);

create table if not exists contribution_cycles (
  id uuid primary key default gen_random_uuid(),
  fund_circle_id uuid not null references fund_circles(id) on delete cascade,
  label text not null,
  cycle_start date not null,
  cycle_end date not null,
  status text not null default 'open' check (status in ('open','closed')),
  created_at timestamptz default now()
);

create table if not exists contributions (
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

create table if not exists contribution_payments (
  id uuid primary key default gen_random_uuid(),
  contribution_id uuid not null references contributions(id) on delete cascade,
  amount numeric(12,2) not null,
  payment_date date not null default current_date,
  recorded_by uuid not null references auth.users(id),
  notes text,
  created_at timestamptz default now()
);

create table if not exists audit_logs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id),
  action text not null,
  entity_type text not null,
  entity_id uuid,
  previous_value jsonb,
  new_value jsonb,
  created_at timestamptz default now()
);

-- --------------------------------------------------
-- Phase 2: Enable RLS on all tables
-- --------------------------------------------------

alter table organizations enable row level security;
alter table organization_members enable row level security;
alter table fund_circles enable row level security;
alter table fund_circle_members enable row level security;
alter table contribution_cycles enable row level security;
alter table contributions enable row level security;
alter table contribution_payments enable row level security;
alter table audit_logs enable row level security;

-- --------------------------------------------------
-- Phase 3: Create all RLS policies (idempotent)
-- --------------------------------------------------

-- Organizations
drop policy if exists "org_select_member" on organizations;
create policy "org_select_member" on organizations for select using (exists (select 1 from organization_members where organization_id = organizations.id and user_id = auth.uid()));

drop policy if exists "org_update_owner" on organizations;
create policy "org_update_owner" on organizations for update using (exists (select 1 from organization_members where organization_id = organizations.id and user_id = auth.uid() and role = 'owner'));

drop policy if exists "org_insert_any" on organizations;
create policy "org_insert_any" on organizations for insert with check (true);

drop policy if exists "org_delete_owner" on organizations;
create policy "org_delete_owner" on organizations for delete using (exists (select 1 from organization_members where organization_id = organizations.id and user_id = auth.uid() and role = 'owner'));

-- Organization membership
drop policy if exists "org_member_select_same_org" on organization_members;
create policy "org_member_select_same_org" on organization_members for select using (exists (select 1 from organization_members my where my.organization_id = organization_members.organization_id and my.user_id = auth.uid()));

drop policy if exists "org_member_insert_admin_or_owner" on organization_members;
create policy "org_member_insert_admin_or_owner" on organization_members for insert with check (exists (select 1 from organization_members where organization_id = organization_members.organization_id and user_id = auth.uid() and role in ('owner', 'admin')));

drop policy if exists "org_member_update_owner" on organization_members;
create policy "org_member_update_owner" on organization_members for update using (exists (select 1 from organization_members where organization_id = organization_members.organization_id and user_id = auth.uid() and role = 'owner'));

drop policy if exists "org_member_delete_owner_or_admin" on organization_members;
create policy "org_member_delete_owner_or_admin" on organization_members for delete using (exists (select 1 from organization_members where organization_id = organization_members.organization_id and user_id = auth.uid() and role in ('owner', 'admin')));

-- Fund Circles
drop policy if exists "fc_select_member" on fund_circles;
create policy "fc_select_member" on fund_circles for select using (exists (select 1 from organization_members where organization_id = fund_circles.organization_id and user_id = auth.uid()));

drop policy if exists "fc_insert_admin_or_owner" on fund_circles;
create policy "fc_insert_admin_or_owner" on fund_circles for insert with check (exists (select 1 from organization_members where organization_id = fund_circles.organization_id and user_id = auth.uid() and role in ('owner', 'admin')));

drop policy if exists "fc_update_admin_or_owner" on fund_circles;
create policy "fc_update_admin_or_owner" on fund_circles for update using (exists (select 1 from organization_members where organization_id = fund_circles.organization_id and user_id = auth.uid() and role in ('owner', 'admin')));

drop policy if exists "fc_delete_admin_or_owner" on fund_circles;
create policy "fc_delete_admin_or_owner" on fund_circles for delete using (exists (select 1 from organization_members where organization_id = fund_circles.organization_id and user_id = auth.uid() and role in ('owner', 'admin')));

-- Fund Circle membership
drop policy if exists "fcm_select_member" on fund_circle_members;
create policy "fcm_select_member" on fund_circle_members for select using (exists (select 1 from fund_circles fc join organization_members om on om.organization_id = fc.organization_id where fc.id = fund_circle_members.fund_circle_id and om.user_id = auth.uid()));

drop policy if exists "fcm_insert_admin_or_owner" on fund_circle_members;
create policy "fcm_insert_admin_or_owner" on fund_circle_members for insert with check (exists (select 1 from fund_circles fc join organization_members om on om.organization_id = fc.organization_id where fc.id = fund_circle_members.fund_circle_id and om.user_id = auth.uid() and om.role in ('owner', 'admin')));

drop policy if exists "fcm_update_admin_or_owner" on fund_circle_members;
create policy "fcm_update_admin_or_owner" on fund_circle_members for update using (exists (select 1 from fund_circles fc join organization_members om on om.organization_id = fc.organization_id where fc.id = fund_circle_members.fund_circle_id and om.user_id = auth.uid() and om.role in ('owner', 'admin')));

drop policy if exists "fcm_delete_admin_or_owner" on fund_circle_members;
create policy "fcm_delete_admin_or_owner" on fund_circle_members for delete using (exists (select 1 from fund_circles fc join organization_members om on om.organization_id = fc.organization_id where fc.id = fund_circle_members.fund_circle_id and om.user_id = auth.uid() and om.role in ('owner', 'admin')));

-- Contribution Cycles
drop policy if exists "cc_select_member" on contribution_cycles;
create policy "cc_select_member" on contribution_cycles for select using (exists (select 1 from fund_circles fc join organization_members om on om.organization_id = fc.organization_id where fc.id = contribution_cycles.fund_circle_id and om.user_id = auth.uid()));

drop policy if exists "cc_insert_admin_or_owner" on contribution_cycles;
create policy "cc_insert_admin_or_owner" on contribution_cycles for insert with check (exists (select 1 from fund_circles fc join organization_members om on om.organization_id = fc.organization_id where fc.id = contribution_cycles.fund_circle_id and om.user_id = auth.uid() and om.role in ('owner', 'admin')));

drop policy if exists "cc_update_admin_or_owner" on contribution_cycles;
create policy "cc_update_admin_or_owner" on contribution_cycles for update using (exists (select 1 from fund_circles fc join organization_members om on om.organization_id = fc.organization_id where fc.id = contribution_cycles.fund_circle_id and om.user_id = auth.uid() and om.role in ('owner', 'admin')));

-- Contribution Records
drop policy if exists "contrib_select_member" on contributions;
create policy "contrib_select_member" on contributions for select using (exists (select 1 from contribution_cycles cc join fund_circles fc on fc.id = cc.fund_circle_id join organization_members om on om.organization_id = fc.organization_id where cc.id = contributions.contribution_cycle_id and om.user_id = auth.uid()));

drop policy if exists "contrib_update_admin_or_owner" on contributions;
create policy "contrib_update_admin_or_owner" on contributions for update using (exists (select 1 from contribution_cycles cc join fund_circles fc on fc.id = cc.fund_circle_id join organization_members om on om.organization_id = fc.organization_id where cc.id = contributions.contribution_cycle_id and om.user_id = auth.uid() and om.role in ('owner', 'admin')));

-- Payment history
drop policy if exists "cp_select_member" on contribution_payments;
create policy "cp_select_member" on contribution_payments for select using (exists (select 1 from contributions c join contribution_cycles cc on cc.id = c.contribution_cycle_id join fund_circles fc on fc.id = cc.fund_circle_id join organization_members om on om.organization_id = fc.organization_id where c.id = contribution_payments.contribution_id and om.user_id = auth.uid()));

drop policy if exists "cp_insert_admin_or_owner" on contribution_payments;
create policy "cp_insert_admin_or_owner" on contribution_payments for insert with check (exists (select 1 from contributions c join contribution_cycles cc on cc.id = c.contribution_cycle_id join fund_circles fc on fc.id = cc.fund_circle_id join organization_members om on om.organization_id = fc.organization_id where c.id = contribution_payments.contribution_id and om.user_id = auth.uid() and om.role in ('owner', 'admin')));

-- Audit logs
drop policy if exists "audit_select_admin_or_owner" on audit_logs;
create policy "audit_select_admin_or_owner" on audit_logs for select using (exists (select 1 from organization_members where organization_id = audit_logs.organization_id and user_id = auth.uid() and role in ('owner', 'admin')));

-- --------------------------------------------------
-- Phase 4: Views
-- --------------------------------------------------

drop view if exists contributions_with_status;
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
