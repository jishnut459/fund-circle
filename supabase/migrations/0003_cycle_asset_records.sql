-- ============================================================
-- 0003: Asset transparency — cycle_asset_records
-- ============================================================
-- Per-cycle log of where the asset-allocated portion of a cycle's
-- collections actually went (RD, FD, cash-in-hand, etc.). Visible to
-- all circle members for transparency; only admins/owners can record
-- or revalue entries.

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

-- ========================================
-- RLS
-- ========================================

alter table cycle_asset_records enable row level security;

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
