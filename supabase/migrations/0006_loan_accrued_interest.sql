-- ============================================================
-- 0006: Daily reducing-balance interest on overdue loan payments
-- ============================================================
-- Adds accrued_interest column to loan_payments so the server
-- can store the exact interest calculated at submission time.
-- This locks in the amount at submission (not verification), so
-- admin delays don't penalise the member.
--
-- The flat loan_late_fee is superseded by this column for regular
-- installment payments going forward.

alter table loan_payments
  add column accrued_interest numeric(12,2) not null default 0;
