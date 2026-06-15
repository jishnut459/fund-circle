-- ============================================================
-- 0001: Loan/asset allocation settings + fixed-term circle dates
-- ============================================================
-- Adds per-circle configuration for the internal lending feature:
--   - split of collected contributions between "assets" and the lending pool
--   - loan interest rate and eligibility caps
--   - flat late-fee + grace-day settings for contributions and loan EMIs
--   - fixed-term start/end dates (extendable later)
--
-- Defaults (asset_allocation_pct=0, loan_allocation_pct=100, no dates) keep
-- existing circles valid against the new constraints without a backfill.

alter table fund_circles
  add column asset_allocation_pct numeric(5,2) not null default 0
    check (asset_allocation_pct >= 0 and asset_allocation_pct <= 100),
  add column loan_allocation_pct numeric(5,2) not null default 100
    check (loan_allocation_pct >= 0 and loan_allocation_pct <= 100),
  add column loan_interest_rate_pct numeric(5,2) not null default 0
    check (loan_interest_rate_pct >= 0),
  add column max_loan_pct_of_contribution numeric(5,2) not null default 90
    check (max_loan_pct_of_contribution >= 0),
  add column max_loan_pct_of_lending_pool numeric(5,2) not null default 10
    check (max_loan_pct_of_lending_pool >= 0),
  add column contribution_late_fee numeric(12,2) not null default 0
    check (contribution_late_fee >= 0),
  add column contribution_grace_days int not null default 0
    check (contribution_grace_days >= 0),
  add column loan_late_fee numeric(12,2) not null default 0
    check (loan_late_fee >= 0),
  add column loan_grace_days int not null default 0
    check (loan_grace_days >= 0),
  add column start_date date,
  add column end_date date,
  add constraint fc_allocation_sums_100 check (asset_allocation_pct + loan_allocation_pct = 100),
  add constraint fc_dates_valid check (start_date is null or end_date is null or end_date >= start_date);
