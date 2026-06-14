-- ============================================================
-- Fund Circle — Circle-Centric Architecture (Migration 0004)
-- ============================================================

-- Phase 1: Add columns (idempotent via IF NOT EXISTS)

alter table fund_circle_members
  add column if not exists role text not null default 'member'
    check (role in ('owner', 'admin', 'member'));

alter table audit_logs
  add column if not exists circle_id uuid references fund_circles(id) on delete set null;

alter table audit_logs
  alter column organization_id drop not null;

alter table organizations
  add column if not exists max_members_per_circle int not null default 20;

-- Phase 2: Reset and recreate all RLS policies
-- Drop all existing policies cleanly first

do $$
declare
  pol record;
begin
  for pol in
    select policyname, tablename
    from pg_policies
    where schemaname = 'public'
      and tablename in (
        'fund_circles','fund_circle_members','contribution_cycles',
        'contributions','contribution_payments','audit_logs'
      )
  loop
    execute format('drop policy if exists %I on %I', pol.policyname, pol.tablename);
  end loop;
end $$;

-- ===== fund_circles =====

create policy "fc_select_member" on fund_circles for select
  using (
    exists (
      select 1 from fund_circle_members fcm
      where fcm.fund_circle_id = fund_circles.id
        and fcm.user_id = auth.uid()
    )
  );

create policy "fc_insert_admin_or_owner" on fund_circles for insert
  with check (
    exists (
      select 1 from organization_members om
      where om.organization_id = fund_circles.organization_id
        and om.user_id = auth.uid()
        and om.role in ('owner', 'admin')
    )
  );

create policy "fc_update_admin_or_owner" on fund_circles for update
  using (
    exists (
      select 1 from fund_circle_members fcm
      where fcm.fund_circle_id = fund_circles.id
        and fcm.user_id = auth.uid()
        and fcm.role in ('owner', 'admin')
    )
  );

create policy "fc_delete_admin_or_owner" on fund_circles for delete
  using (
    exists (
      select 1 from fund_circle_members fcm
      where fcm.fund_circle_id = fund_circles.id
        and fcm.user_id = auth.uid()
        and fcm.role in ('owner', 'admin')
    )
  );

-- ===== fund_circle_members =====

create policy "fcm_select_member" on fund_circle_members for select
  using (
    exists (
      select 1 from fund_circle_members fcm2
      where fcm2.fund_circle_id = fund_circle_members.fund_circle_id
        and fcm2.user_id = auth.uid()
    )
  );

create policy "fcm_insert_admin_or_owner" on fund_circle_members for insert
  with check (
    exists (
      select 1 from fund_circle_members fcm2
      where fcm2.fund_circle_id = fund_circle_members.fund_circle_id
        and fcm2.user_id = auth.uid()
        and fcm2.role in ('owner', 'admin')
    )
  );

create policy "fcm_update_admin_or_owner" on fund_circle_members for update
  using (
    exists (
      select 1 from fund_circle_members fcm2
      where fcm2.fund_circle_id = fund_circle_members.fund_circle_id
        and fcm2.user_id = auth.uid()
        and fcm2.role in ('owner', 'admin')
    )
  );

create policy "fcm_delete_admin_or_owner" on fund_circle_members for delete
  using (
    exists (
      select 1 from fund_circle_members fcm2
      where fcm2.fund_circle_id = fund_circle_members.fund_circle_id
        and fcm2.user_id = auth.uid()
        and fcm2.role in ('owner', 'admin')
    )
  );

-- ===== contribution_cycles =====

create policy "cc_select_member" on contribution_cycles for select
  using (
    exists (
      select 1 from fund_circle_members fcm
      where fcm.fund_circle_id = contribution_cycles.fund_circle_id
        and fcm.user_id = auth.uid()
    )
  );

create policy "cc_insert_admin_or_owner" on contribution_cycles for insert
  with check (
    exists (
      select 1 from fund_circle_members fcm
      where fcm.fund_circle_id = contribution_cycles.fund_circle_id
        and fcm.user_id = auth.uid()
        and fcm.role in ('owner', 'admin')
    )
  );

create policy "cc_update_admin_or_owner" on contribution_cycles for update
  using (
    exists (
      select 1 from fund_circle_members fcm
      where fcm.fund_circle_id = contribution_cycles.fund_circle_id
        and fcm.user_id = auth.uid()
        and fcm.role in ('owner', 'admin')
    )
  );

-- ===== contributions =====

create policy "contrib_select_member" on contributions for select
  using (
    exists (
      select 1 from contribution_cycles cc
      join fund_circle_members fcm on fcm.fund_circle_id = cc.fund_circle_id
      where cc.id = contributions.contribution_cycle_id
        and fcm.user_id = auth.uid()
    )
  );

create policy "contrib_update_admin_or_owner" on contributions for update
  using (
    exists (
      select 1 from contribution_cycles cc
      join fund_circle_members fcm on fcm.fund_circle_id = cc.fund_circle_id
      where cc.id = contributions.contribution_cycle_id
        and fcm.user_id = auth.uid()
        and fcm.role in ('owner', 'admin')
    )
  );

-- ===== contribution_payments =====

create policy "cp_select_member" on contribution_payments for select
  using (
    exists (
      select 1 from contributions c
      join contribution_cycles cc on cc.id = c.contribution_cycle_id
      join fund_circle_members fcm on fcm.fund_circle_id = cc.fund_circle_id
      where c.id = contribution_payments.contribution_id
        and fcm.user_id = auth.uid()
    )
  );

create policy "cp_insert_admin_or_owner" on contribution_payments for insert
  with check (
    exists (
      select 1 from contributions c
      join contribution_cycles cc on cc.id = c.contribution_cycle_id
      join fund_circle_members fcm on fcm.fund_circle_id = cc.fund_circle_id
      where c.id = contribution_payments.contribution_id
        and fcm.user_id = auth.uid()
        and fcm.role in ('owner', 'admin')
    )
  );

-- ===== audit_logs =====

create policy "audit_select_admin_or_owner" on audit_logs for select
  using (
    (
      audit_logs.circle_id is not null
      and exists (
        select 1 from fund_circle_members fcm
        where fcm.fund_circle_id = audit_logs.circle_id
          and fcm.user_id = auth.uid()
          and fcm.role in ('owner', 'admin')
      )
    )
    or
    (
      audit_logs.circle_id is null
      and exists (
        select 1 from organization_members om
        where om.organization_id = audit_logs.organization_id
          and om.user_id = auth.uid()
          and om.role in ('owner', 'admin')
      )
    )
  );

-- Phase 3: Backfill circle members with roles

update fund_circle_members fcm
set role = 'owner'
where fcm.role = 'member'
  and exists (
    select 1 from fund_circles fc
    join organization_members om
      on om.organization_id = fc.organization_id
      and om.user_id = fcm.user_id
    where fc.id = fcm.fund_circle_id
      and om.role = 'owner'
  );

update fund_circle_members fcm
set role = 'admin'
where fcm.role = 'member'
  and exists (
    select 1 from fund_circles fc
    join organization_members om
      on om.organization_id = fc.organization_id
      and om.user_id = fcm.user_id
    where fc.id = fcm.fund_circle_id
      and om.role = 'admin'
  );

-- Phase 4: Recreate view

drop view if exists contributions_with_status cascade;
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
