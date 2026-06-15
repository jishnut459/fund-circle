-- ============================================================
-- 0002: Internal lending core — loans, installments, payments
-- ============================================================
-- Adds the core tables for the internal lending feature:
--   - loans: member loan requests through approval/issuance to closure
--   - loan_installments: amortization schedule per loan (no stored status —
--     derived via loan_installments_with_status)
--   - loan_payments: payment history per installment
--
-- Visibility mirrors contributions: a member sees their own loans; admins
-- and owners see every loan in their circle.

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

-- ========================================
-- RLS
-- ========================================

alter table loans enable row level security;
alter table loan_installments enable row level security;
alter table loan_payments enable row level security;

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

-- ========================================
-- View: loan_installments_with_status
-- ========================================

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
