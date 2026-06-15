-- ============================================================
-- 0004: Circle settlement — circle_settlements + payouts
-- ============================================================
-- Tracks the final distribution of a circle's total fund value
-- among members proportional to their lifetime contributions.
-- A single draft settlement is computed and can be recalculated;
-- finalization locks it and closes the circle.

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

-- ========================================
-- RLS
-- ========================================

alter table circle_settlements enable row level security;
alter table circle_settlement_payouts enable row level security;

-- All active members can view the settlement for their circle
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

-- Members see their own payout row; admins see all payouts for the circle
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
