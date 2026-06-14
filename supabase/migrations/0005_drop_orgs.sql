-- ============================================================
-- Fund Circle — Drop Organizations, Bill Circles Directly (Migration 0005)
-- ============================================================

-- 1. Add billing columns to fund_circles
alter table fund_circles
  add column if not exists subscription_plan text not null default 'free'
    check (subscription_plan in ('free','pro','premium'));

alter table fund_circles
  add column if not exists max_members int not null default 20;

-- 2. Backfill plan + member limits from organizations
update fund_circles fc
set subscription_plan = o.subscription_plan,
    max_members = o.max_members_per_circle
from organizations o
where fc.organization_id = o.id;

-- 3. Drop organization_id from org_invites
alter table org_invites
  drop constraint if exists org_invites_organization_id_fkey;
alter table org_invites
  drop column if exists organization_id;

-- 4. Drop organization_id from audit_logs
alter table audit_logs
  drop column if exists organization_id;

-- 5. Drop organization_id FK + column from fund_circles
alter table fund_circles
  drop constraint if exists fund_circles_organization_id_fkey;
alter table fund_circles
  drop column if exists organization_id;

-- 6. Drop org tables
drop table if exists organization_members cascade;
drop table if exists organizations cascade;

-- 7. Rewrite fund_circles INSERT policy (any authenticated user)
drop policy if exists "fc_insert_admin_or_owner" on fund_circles;
create policy "fc_insert_authenticated" on fund_circles for insert
  with check (auth.uid() is not null);

-- 8. Rewrite audit_logs RLS (circle-only)
drop policy if exists "audit_select_admin_or_owner" on audit_logs;
create policy "audit_select_admin_or_owner" on audit_logs for select
  using (
    exists (
      select 1 from fund_circle_members fcm
      where fcm.fund_circle_id = audit_logs.circle_id
        and fcm.user_id = auth.uid()
        and fcm.role in ('owner','admin')
    )
  );
