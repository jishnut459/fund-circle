-- ============================================================
-- 0003: Payment verification workflow
-- ============================================================
-- Adds member self-reporting + admin verification to both
-- contribution payments and loan payments.
--
-- Key changes:
--   contribution_payments: status (pending/verified/rejected),
--     submitted_by, verified_by, verified_at, rejection_reason
--   loan_payments: same verification columns + payment_type
--     (regular/prepayment/foreclosure), prepayment_strategy,
--     loan_id (for loan-level payments), installment_id made nullable
--
-- Existing rows default to 'verified' — no data migration needed.

-- ============================================================
-- contribution_payments
-- ============================================================

alter table contribution_payments
  add column status           text        not null default 'verified'
    check (status in ('pending','verified','rejected')),
  add column submitted_by     uuid        references auth.users(id),
  add column verified_by      uuid        references auth.users(id),
  add column verified_at      timestamptz,
  add column rejection_reason text;

-- Members can submit a pending payment for their own contribution
create policy "cp_insert_member_self" on contribution_payments for insert
  with check (
    status = 'pending'
    and submitted_by = auth.uid()
    and exists (
      select 1 from contributions c
      join contribution_cycles cc on cc.id = c.contribution_cycle_id
      join fund_circle_members fcm
        on fcm.fund_circle_id = cc.fund_circle_id
       and fcm.user_id = auth.uid()
       and fcm.active = true
      where c.id = contribution_payments.contribution_id
        and c.user_id = auth.uid()
    )
  );

-- Admins/owners can verify or reject pending payments
create policy "cp_update_admin_or_owner" on contribution_payments for update
  using (
    exists (
      select 1 from contributions c
      join contribution_cycles cc on cc.id = c.contribution_cycle_id
      join fund_circle_members fcm
        on fcm.fund_circle_id = cc.fund_circle_id
       and fcm.user_id = auth.uid()
       and fcm.role in ('owner','admin')
      where c.id = contribution_payments.contribution_id
    )
  );

-- ============================================================
-- loan_payments
-- ============================================================

-- Make installment_id nullable so loan-level payments
-- (prepayment, foreclosure) can reference the loan directly.
alter table loan_payments
  alter column loan_installment_id drop not null;

alter table loan_payments
  add column loan_id              uuid        references loans(id) on delete cascade,
  add column status               text        not null default 'verified'
    check (status in ('pending','verified','rejected')),
  add column payment_type         text        not null default 'regular'
    check (payment_type in ('regular','prepayment','foreclosure')),
  add column prepayment_strategy  text
    check (prepayment_strategy in ('reduce_emi','reduce_tenure')),
  add column submitted_by         uuid        references auth.users(id),
  add column verified_by          uuid        references auth.users(id),
  add column verified_at          timestamptz,
  add column rejection_reason     text;

-- Either an installment or a loan must be referenced
alter table loan_payments
  add constraint lp_entity_check
    check (loan_installment_id is not null or loan_id is not null);

-- Members can submit pending regular payments against their own loan's installments
create policy "lp_insert_member_self_regular" on loan_payments for insert
  with check (
    status = 'pending'
    and payment_type = 'regular'
    and submitted_by = auth.uid()
    and loan_installment_id is not null
    and exists (
      select 1 from loan_installments li
      join loans l on l.id = li.loan_id
      join fund_circle_members fcm
        on fcm.fund_circle_id = l.fund_circle_id
       and fcm.user_id = auth.uid()
       and fcm.active = true
      where li.id = loan_payments.loan_installment_id
        and l.user_id = auth.uid()
    )
  );

-- Members can submit pending prepayments or foreclosures against their own loan
create policy "lp_insert_member_self_loan_level" on loan_payments for insert
  with check (
    status = 'pending'
    and payment_type in ('prepayment','foreclosure')
    and submitted_by = auth.uid()
    and loan_id is not null
    and loan_installment_id is null
    and exists (
      select 1 from loans l
      join fund_circle_members fcm
        on fcm.fund_circle_id = l.fund_circle_id
       and fcm.user_id = auth.uid()
       and fcm.active = true
      where l.id = loan_payments.loan_id
        and l.user_id = auth.uid()
    )
  );

-- Admins/owners can verify or reject pending loan payments
create policy "lp_update_admin_or_owner" on loan_payments for update
  using (
    exists (
      select 1 from loan_installments li
      join loans l on l.id = li.loan_id
      join fund_circle_members fcm
        on fcm.fund_circle_id = l.fund_circle_id
       and fcm.user_id = auth.uid()
       and fcm.role in ('owner','admin')
      where li.id = loan_payments.loan_installment_id
    )
    or
    exists (
      select 1 from loans l
      join fund_circle_members fcm
        on fcm.fund_circle_id = l.fund_circle_id
       and fcm.user_id = auth.uid()
       and fcm.role in ('owner','admin')
      where l.id = loan_payments.loan_id
    )
  );
