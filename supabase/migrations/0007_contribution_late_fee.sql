-- ============================================================
-- 0007: Track late fees on contributions
-- ============================================================
-- Members who pay after a cycle's due date + grace period owe a flat
-- late fee (fund_circles.contribution_late_fee). We store the fee that
-- was actually levied on each contribution so the "paid" target becomes
-- expected_amount + late_fee, and the status view reflects it.
--
-- Default 0 keeps every existing contribution unchanged (no fee owed).

alter table contributions
  add column if not exists late_fee numeric(12,2) not null default 0
    check (late_fee >= 0);

-- Status is now measured against expected_amount + late_fee so that paying
-- the fee counts as "paid" rather than "overpaid", and skipping it leaves
-- the contribution "partially_paid". The view is dropped first because adding
-- late_fee to `c.*` shifts column positions, which CREATE OR REPLACE forbids.
drop view if exists contributions_with_status;
create view contributions_with_status as
select
  c.*,
  case
    when c.paid_amount = 0 then 'unpaid'
    when c.paid_amount < c.expected_amount + c.late_fee then 'partially_paid'
    when c.paid_amount = c.expected_amount + c.late_fee then 'paid'
    else 'overpaid'
  end as status
from contributions c;
