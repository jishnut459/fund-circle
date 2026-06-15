# Feature Roadmap: Loans, Asset Transparency & Circle Settlement

This document breaks down a large feature set into ~19 small, independently implementable and testable chunks. Each chunk is sized to be completed and verified within a single working session. Pick up chunks roughly in order — later chunks list their dependencies.

## Feature Summary

Fund Circle currently handles recurring contributions only. This roadmap adds three connected capabilities:

1. **Internal lending** — circles split collected contributions between "assets" (growth) and a "lending pool". Admins/owners issue loans to members at interest, with amortized (reducing-balance) EMI repayment, eligibility caps, and late fees. Loans are member-requested and admin/owner-approved (no self-approval, mirroring the rule that you can't mark your own contribution as paid).
2. **Asset transparency** — at the close of each cycle, admins record where the asset-allocated portion of that cycle's money actually went (recurring deposit, fixed deposit, cash-in-hand, mutual fund, etc.), giving members visibility into how their money is being used. Records can be revalued later to reflect actual returns.
3. **Circle settlement at expiry** — circles run for a fixed term (`start_date`/`end_date`, extendable). All loans must close before expiry (enforced at issuance). When the circle ends, the total fund value (contributions + asset returns + loan interest) is split among members proportional to their lifetime contributions, with per-member disbursement tracking. No early exit — the only payout point is circle expiry. Members who join later still participate, just with a smaller proportional share.

This roadmap was designed against the current schema (`supabase/seed.sql`, single consolidated seed, no migrations yet) and existing conventions: `ActionResult<T>` in `src/lib/types.ts`, `lib/permissions.ts` role helpers, `writeAuditLog()` in `lib/audit.ts`, `numeric(12,2)` for money, text + CHECK constraints instead of Postgres enums, RLS naming `[prefix]_[op]_[role]`, and computed-status views (no stored derivable status columns).

---

## Architecture Overview

### A. Schema additions

**New migrations** (the `supabase/migrations/` folder is currently empty — this establishes migration history going forward):
- `0001_loan_settings_and_circle_dates.sql` — adds columns to `fund_circles`
- `0002_loans_core.sql` — `loans`, `loan_installments`, `loan_payments` + view + RLS
- `0003_cycle_asset_records.sql` — `cycle_asset_records` + RLS
- `0004_circle_settlement.sql` — `circle_settlements`, `circle_settlement_payouts` + RLS

Also append equivalent DDL to `supabase/seed.sql` (drops in Phase 1, tables in Phase 3, RLS in Phase 5, views in Phase 6) so local resets stay in sync — `seed.sql` remains the "current state" snapshot; migrations are the historical diff.

#### `fund_circles` additions (migration 0001)

```sql
alter table fund_circles
  add column asset_allocation_pct numeric(5,2) not null default 0
    check (asset_allocation_pct >= 0 and asset_allocation_pct <= 100),
  add column loan_allocation_pct numeric(5,2) not null default 100
    check (loan_allocation_pct >= 0 and loan_allocation_pct <= 100),
  add column loan_interest_rate_pct numeric(5,2) not null default 0 check (loan_interest_rate_pct >= 0),
  add column max_loan_pct_of_contribution numeric(5,2) not null default 90 check (max_loan_pct_of_contribution >= 0),
  add column max_loan_pct_of_lending_pool numeric(5,2) not null default 10 check (max_loan_pct_of_lending_pool >= 0),
  add column contribution_late_fee numeric(12,2) not null default 0 check (contribution_late_fee >= 0),
  add column contribution_grace_days int not null default 0 check (contribution_grace_days >= 0),
  add column loan_late_fee numeric(12,2) not null default 0 check (loan_late_fee >= 0),
  add column loan_grace_days int not null default 0 check (loan_grace_days >= 0),
  add column start_date date,
  add column end_date date,
  add constraint fc_allocation_sums_100 check (asset_allocation_pct + loan_allocation_pct = 100),
  add constraint fc_dates_valid check (start_date is null or end_date is null or end_date >= start_date);
```

#### `loans` (migration 0002)

```sql
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
  interest_rate_pct numeric(5,2),       -- snapshot of circle rate at issuance
  purpose text,
  requested_by uuid not null references auth.users(id),
  reviewed_by uuid references auth.users(id),
  reviewed_at timestamptz,
  issued_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
```

#### `loan_installments`

```sql
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
```

No stored status column — derive via view `loan_installments_with_status`:

```sql
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
```

#### `loan_payments`

```sql
create table loan_payments (
  id uuid primary key default gen_random_uuid(),
  loan_installment_id uuid not null references loan_installments(id) on delete cascade,
  amount numeric(12,2) not null check (amount > 0),
  payment_date date not null default current_date,
  recorded_by uuid not null references auth.users(id),
  notes text,
  created_at timestamptz default now()
);
```

#### RLS for loans/installments/payments (migration 0002)

Following `[prefix]_[op]_[role]`:
- `loans_select_member`: `using (user_id = auth.uid() or exists(select 1 from fund_circle_members fcm where fcm.fund_circle_id = loans.fund_circle_id and fcm.user_id = auth.uid() and fcm.role in ('owner','admin')))`
- `loans_insert_member`: `with check (user_id = auth.uid() and requested_by = auth.uid())`
- `loans_update_admin_or_owner`: admin/owner only (approve/reject/issue/close)
- `loan_installments_select_member` / `loan_installments_update_admin_or_owner`: via join to `loans` → `fund_circle_members`, same visibility rule
- `loan_payments_select_member` / `loan_payments_insert_admin_or_owner`: via join chain loan_installments → loans → fcm

#### `cycle_asset_records` (migration 0003)

Per-cycle transparency log of where the asset-allocated portion of collections went:

```sql
create table cycle_asset_records (
  id uuid primary key default gen_random_uuid(),
  fund_circle_id uuid not null references fund_circles(id) on delete cascade,
  contribution_cycle_id uuid references contribution_cycles(id) on delete set null,
  asset_type text not null check (asset_type in ('recurring_deposit','fixed_deposit','cash_in_hand','mutual_fund','other')),
  institution text,
  amount numeric(12,2) not null check (amount >= 0),       -- amount allocated at time of recording
  current_value numeric(12,2),                              -- nullable; admin can revalue later (maturity/returns)
  notes text,
  recorded_by uuid not null references auth.users(id),
  recorded_at date not null default current_date,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
```

RLS: `car_select_member` (all members — this is a transparency feature), `car_insert_admin_or_owner`, `car_update_admin_or_owner` (for revaluation).

#### `circle_settlements` / `circle_settlement_payouts` (migration 0004)

Computed once near/at circle expiry:

```sql
create table circle_settlements (
  id uuid primary key default gen_random_uuid(),
  fund_circle_id uuid not null unique references fund_circles(id) on delete cascade,
  total_value numeric(12,2) not null check (total_value >= 0),
  total_contributions_base numeric(12,2) not null,  -- denominator for proportional shares
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
  contribution_total numeric(12,2) not null,  -- member's lifetime paid contributions
  share_amount numeric(12,2) not null,
  disbursed boolean not null default false,
  disbursed_at timestamptz,
  disbursed_by uuid references auth.users(id),
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (circle_settlement_id, user_id)
);
```

RLS: `cs_select_member` (members see their own circle's settlement + their own payout row; admins see all payout rows for the circle), `cs_insert_admin_or_owner` / `csp_insert_admin_or_owner` (recalculation while draft), `csp_update_admin_or_owner` (disbursement).

Settlement finalization sets `fund_circles.status = 'closed'` (existing status enum already supports this — no new circle status needed).

---

### B. Utility layer — `src/lib/loans.ts`

Pure functions (no Supabase calls), shared by server actions and UI:

```ts
export type AmortizationRow = { installmentNumber: number; dueDate: string; principalComponent: number; interestComponent: number; totalDue: number }

export function calculateEMI(principal: number, annualRatePct: number, termMonths: number): number
// reducing-balance: EMI = P * r * (1+r)^n / ((1+r)^n - 1), r = annualRatePct/1200; r=0 -> P/n

export function generateAmortizationSchedule(principal: number, annualRatePct: number, termMonths: number, issueDate: Date): AmortizationRow[]
// monthly installments starting 1 month after issueDate; last row absorbs rounding remainder

export function computeLendingPoolAvailable(params: {
  totalContributionsCollected: number
  loanAllocationPct: number
  totalPrincipalOutstanding: number
}): number
// available = (totalContributionsCollected * loanAllocationPct/100) - totalPrincipalOutstanding

export function computeEligibility(params: {
  totalContributionsPaid: number
  maxLoanPctOfContribution: number
  lendingPoolAvailable: number
  maxLoanPctOfLendingPool: number
  outstandingPrincipal: number
}): { maxByContribution: number; maxByPool: number; eligibleAmount: number }
// eligibleAmount = max(0, min(maxByContribution, maxByPool) - outstandingPrincipal)

export function computeAssetsValue(totalContributionsCollected: number, assetAllocationPct: number): number

export function finalInstallmentDate(issueDate: Date, termMonths: number): Date
// used to validate against circle.end_date at loan issuance
```

`src/lib/settlement.ts` (new, small):

```ts
export function computeMemberShare(memberContributionTotal: number, totalContributionsBase: number, totalValue: number): number
// share = totalContributionsBase > 0 ? (memberContributionTotal / totalContributionsBase) * totalValue : 0
```

---

### C. Server actions (`src/lib/actions.ts` unless noted)

| Action | Purpose | Audit |
|---|---|---|
| `createFundCircle(...)` — extended | Add optional `loanSettings`/`startDate`/`endDate` params (object-based to avoid arg explosion); validates allocation% sums to 100 | `fund_circle_created` (existing) |
| `updateLoanSettings(circleId, settings, actorUserId)` | Edit allocation %, interest rate, eligibility caps, late fees/grace days. Validates sums/ranges | `loan_settings_updated` / entity `fund_circle` |
| `extendCircleEndDate(circleId, newEndDate, actorUserId)` | Push out `end_date`; validates `>= current end_date` and `>= start_date` | `circle_extended` / entity `fund_circle` |
| `getLoanEligibility(circleId, userId)` | Read-only: returns eligibility breakdown via `lib/loans.ts` | — |
| `requestLoan(circleId, userId, amount, termMonths, purpose)` | Member creates loan request; server-side eligibility + `finalInstallmentDate <= end_date` check | `loan_request_created` / entity `loan` |
| `cancelLoanRequest(loanId, userId, circleId)` | Member withdraws own pending request | `loan_request_cancelled` |
| `reviewLoanRequest(loanId, circleId, actorUserId, decision, approvedAmount?, approvedTermMonths?)` | Admin/owner approve (generates `loan_installments` via amortization) or reject. Blocks self-approval | `loan_approved`/`loan_rejected`/`loan_issued` |
| `recordLoanPayment(loanInstallmentId, amount, notes, actorUserId, circleId)` | Apply payment to targeted installment; flat late fee if `current_date > due_date + loan_grace_days` and was unpaid; closes loan when all installments paid | `loan_payment_recorded` / entity `loan_installment` |
| `addCycleAssetRecord(circleId, cycleId, assetType, institution, amount, notes, actorUserId)` | Record where asset-allocated portion of a cycle's collection went | `cycle_asset_recorded` / entity `cycle_asset_record` |
| `updateAssetRecordValue(recordId, currentValue, actorUserId, circleId)` | Revalue an asset record later (maturity/returns) | `asset_record_revalued` |
| `calculateCircleSettlement(circleId, actorUserId, totalValueOverride?)` | Computes draft settlement: suggested `total_value` = sum(contributions paid) + sum(loan interest collected) + sum(asset current_value - amount deltas); admin can override. Blocks if any loan not in a terminal/closed state. Upserts `circle_settlements` (draft) + `circle_settlement_payouts` rows | `circle_settlement_calculated` / entity `circle_settlement` |
| `finalizeCircleSettlement(circleId, actorUserId)` | Locks settlement (`status='finalized'`), sets `fund_circles.status='closed'` | `circle_settlement_finalized` |
| `recordSettlementDisbursement(payoutId, circleId, actorUserId, notes?)` | Marks a member's payout as disbursed | `settlement_payout_disbursed` / entity `circle_settlement_payout` |

New audit entity types: `loan`, `loan_installment`, `cycle_asset_record`, `circle_settlement`, `circle_settlement_payout`.

---

### D. Permissions (`src/lib/permissions.ts`)

```ts
export function canManageLoans(role: string): boolean { return isAdminOrOwner(role) }
export function canEditLoanSettings(role: string): boolean { return isAdminOrOwner(role) }
export function canExtendCircle(role: string): boolean { return isAdminOrOwner(role) }
export function canRecordAssetAllocation(role: string): boolean { return isAdminOrOwner(role) }
export function canManageSettlement(role: string): boolean { return isAdminOrOwner(role) }
```

Members can always create their own loan requests (no helper needed — gated by `requested_by = userId` in the action). Self-approval is blocked explicitly in `reviewLoanRequest` (mirrors "can't mark your own contribution as paid").

---

### E. Pages, components, nav

**New routes**:
- `circles/[circleId]/loans/page.tsx` — member's loans + (admin) pending requests section
- `circles/[circleId]/loans/[loanId]/page.tsx` — installment schedule detail
- `circles/[circleId]/loans/new/page.tsx` — request form + EMI calculator + eligibility
- `circles/[circleId]/settlement/page.tsx` — asset allocation log (all members) + settlement breakdown (visible near/after `end_date`)

**New components** (`src/components/loans/`): `LoanStatusBadge.tsx`, `LoanCard.tsx`, `LoanInstallmentTable.tsx`, `EMICalculator.tsx`, `EligibilityWidget.tsx`, `LoanRequestForm.tsx`, `LoanReviewDialog.tsx`, `RecordLoanPaymentDialog.tsx`, `LoanSettingsForm.tsx`, `ExtendCircleDialog.tsx`.

**New components** (`src/components/settlement/`): `AssetRecordForm.tsx`, `AssetRecordList.tsx`, `SettlementSummary.tsx`, `SettlementPayoutTable.tsx`.

**Status colors** — stay within existing palette (no new accent color per CLAUDE.md): loan/installment `pending`/`pending_request`/`cancelled`/`rejected` → gray (unpaid-style); `partially_paid` → amber; `overdue` → amber + `AlertTriangle` icon for distinction; `paid`/`closed` → green; `active` → blue (reuse "overpaid"/info blue as "in progress").

**Nav (`AppShell.tsx`)**: add "Loans" to sidebar `circleLinks` (icon `HandCoins`) and to mobile `mainTabs` → Dashboard, Members, Payments, Loans + "More" = 5 (within 4-5 item constraint). Settlement page is **not** a nav tab — reached via a Dashboard banner/card that appears when `end_date` is within 30 days or passed, and via a link in Settings (admin). Asset allocation log is reached from the same `settlement` page (members can view anytime for transparency, not just at expiry).

**FundCircleForm.tsx**: add fields for asset/loan allocation % (linked, sum to 100), loan interest rate, eligibility caps, late-fee+grace-day pairs (contribution & loan), `start_date`/`end_date`. Switch `createFundCircle` to accept an options object for the new fields (avoid positional-arg explosion), keeping existing params for backward compatibility.

**Cycle close flow** (`cycles/[cycleId]` or wherever `closeCycle` is triggered): after closing, show the cycle's asset-allocated amount (`cycle total collected * asset_allocation_pct`) and prompt admin to log `addCycleAssetRecord` entries (can be skipped/done later from the settlement page's asset log).

---

## Chunk Breakdown

Sized so each chunk is implementable AND testable within a single session — no chunk depends on a *later* chunk to be verifiable. Every chunk ends with `npm run lint` + `npx tsc --noEmit` plus a concrete manual/SQL check.

### 1. Migration 0001 — circle loan/asset settings + dates
Files: `supabase/migrations/0001_loan_settings_and_circle_dates.sql`, `supabase/seed.sql` (add same columns to `fund_circles` in Phase 3).
Deps: none.
Test: run seed locally; `insert`/`update` a circle row directly via SQL — confirm defaults (`loan_allocation_pct=100`, `asset_allocation_pct=0`), confirm `update fund_circles set asset_allocation_pct=60, loan_allocation_pct=50` is rejected by `fc_allocation_sums_100`, confirm `end_date < start_date` rejected.

### 2. Migration 0002 — loans core tables, view, RLS
Files: `supabase/migrations/0002_loans_core.sql`, `supabase/seed.sql` (drops in Phase 1, tables in Phase 3, RLS in Phase 5, view in Phase 6).
Deps: 1.
Test: run seed; manually insert a `loans` row + a couple `loan_installments` rows via SQL, query `loan_installments_with_status` and confirm `pending`/`overdue`/`paid` derive correctly for different `paid_amount`/`due_date` combos; as a non-admin test user confirm SELECT on another member's loan is blocked, INSERT into `loans` with someone else's `user_id` is blocked.

### 3. `lib/loans.ts` calculation utilities + `LoanSettings` type
Files: `src/lib/loans.ts` (new), `src/lib/types.ts` (add `LoanSettings` type matching migration 0001 columns).
Deps: none (pure functions, can be built before/parallel with 1-2).
Test: `npx tsc --noEmit`; write a quick throwaway script or temporary test calling `calculateEMI`/`generateAmortizationSchedule` with textbook values (e.g. principal=100000, rate=12%, term=12) and confirm EMI ≈ ₹8884.88 and schedule's principal components sum to 100000; confirm `computeEligibility`/`computeLendingPoolAvailable` match hand-calculated examples from the user's spec (90% of contribution vs 10% of pool, whichever lower).

### 4. `EMICalculator.tsx` standalone component
Files: `src/components/loans/EMICalculator.tsx`.
Deps: 3.
Test: drop the component onto any existing page temporarily (or a scratch route), run `npm run dev`, enter amount/rate/term, confirm displayed EMI and schedule table match chunk 3's verified values; check mobile (360px) and dark mode rendering.

### 5. `FundCircleForm.tsx` new fields + `createFundCircle` extended
Files: `src/components/fund-circles/FundCircleForm.tsx`, `src/lib/actions.ts` (`createFundCircle`).
Deps: 1, 3 (for `LoanSettings` type).
Test: `npm run dev`, create a new circle through the UI with custom allocation %, interest rate, eligibility caps, late fees/grace days, start/end dates; confirm row in `fund_circles` has correct values; confirm a sum≠100 submission shows a client-side error before hitting the server action; confirm existing circles (created before this chunk) still load fine with column defaults.

### 6. `getLoanEligibility` action + `EligibilityWidget.tsx`
Files: `src/lib/actions.ts` (`getLoanEligibility`), `src/components/loans/EligibilityWidget.tsx`.
Deps: 1, 3, 5 (need a circle with settings to query).
Test: seed a circle + member with known contribution totals; render widget for that member; manually compute expected `maxByContribution`/`maxByPool`/`eligibleAmount` and confirm widget matches. With zero contributions, confirm eligibility is 0, not an error.

### 7. Loan request flow — `requestLoan`/`cancelLoanRequest` + `LoanRequestForm.tsx` + `/loans/new` page
Files: `src/lib/actions.ts` (`requestLoan`, `cancelLoanRequest`), `src/components/loans/LoanRequestForm.tsx`, `src/app/(app)/circles/[circleId]/loans/new/page.tsx`.
Deps: 2, 3, 6 (embeds EMICalculator + EligibilityWidget).
Test: as a member, submit a request within eligibility — confirm `loans` row created with `status='pending_request'` and an audit_logs row (`loan_request_created`); submit a request over eligibility — confirm rejected with plain-language error and no row created; submit with a term that pushes the final installment past `end_date` — confirm rejected; cancel a pending request — confirm `status='cancelled'`.

### 8. Admin approval/issuance — `reviewLoanRequest` + `LoanReviewDialog.tsx`
Files: `src/lib/actions.ts` (`reviewLoanRequest`), `src/components/loans/LoanReviewDialog.tsx`, pending-requests list (can live in a temporary section of `/loans/page.tsx` — full page comes in chunk 10).
Deps: 7.
Test: as admin, approve a pending request — confirm `loans.status='active'`, `issued_at` set, `loan_installments` rows generated whose `principal_component` sum equals `approved_amount` and whose `total_due` sum equals principal + total interest from `lib/loans.ts`; reject another request — confirm terminal `rejected` status; attempt to approve your own request as the requester (if also admin) — confirm blocked.

### 9. Loan repayment — `recordLoanPayment` + `RecordLoanPaymentDialog.tsx` + `LoanStatusBadge.tsx`
Files: `src/lib/actions.ts` (`recordLoanPayment`), `src/components/loans/RecordLoanPaymentDialog.tsx`, `src/components/loans/LoanStatusBadge.tsx`.
Deps: 8 (need an active loan with installments).
Test: record an on-time payment for installment 1 — confirm `paid_amount` updated, no late fee, `loan_installments_with_status` shows `paid`; backdate/force an installment past `due_date + loan_grace_days` (via SQL) and record a payment — confirm `loan_late_fee` added to `late_fee_applied`/`total_due`; pay off the final installment — confirm `loans.status='closed'`; confirm `loan_payment_recorded` audit entries for each.

### 10. Member loan list page + nav entry
Files: `src/app/(app)/circles/[circleId]/loans/page.tsx`, `src/components/loans/LoanCard.tsx`, `src/components/layout/AppShell.tsx` (add "Loans" tab).
Deps: 7-9 for real data; page shell itself only needs 2 (schema) to query against.
Test: `npm run dev` — confirm "Loans" appears as 4th item in mobile bottom nav (Dashboard/Members/Payments/Loans + "More" = 5) and in desktop sidebar; as a member with no loans, confirm empty state with icon + CTA to `/loans/new`; as a member with loans from chunks 7-9, confirm cards show correct status badges, progress, and next-EMI amount/date; verify mobile (360px) and dark mode.

### 11. Loan detail page — installment schedule
Files: `src/app/(app)/circles/[circleId]/loans/[loanId]/page.tsx`, `src/components/loans/LoanInstallmentTable.tsx`.
Deps: 9, 10.
Test: open a loan with mixed installment statuses (paid/overdue/pending from chunk 9's test data); confirm table shows all installments with correct status badges, no horizontal scroll at 360px (collapses per CLAUDE.md), and admin sees a "record payment" action per row while a member viewing their own loan does not see the action on others' loans (RLS + UI gating).

### 12. Circle extension — `extendCircleEndDate` + `ExtendCircleDialog.tsx`
Files: `src/lib/actions.ts` (`extendCircleEndDate`), `src/components/loans/ExtendCircleDialog.tsx`, settings page integration.
Deps: 1.
Test: as admin, extend `end_date` to a later date — confirm `fund_circles.end_date` updated and `circle_extended` audit entry with prev/new values; attempt to set an earlier date — confirm rejected.

### 13. Loan settings editing — `updateLoanSettings` + `LoanSettingsForm.tsx`
Files: `src/lib/actions.ts` (`updateLoanSettings`), `src/components/loans/LoanSettingsForm.tsx`, settings page integration.
Deps: 1, 5.
Test: as admin, edit allocation percentages to values summing to 100 — confirm saved + `loan_settings_updated` audit entry with prev/new diff; attempt sum≠100 — confirm client-side block and, if bypassed, server/DB rejection via the chunk-1 constraint; as a member, confirm the settings form is not rendered/editable.

### 14. Dashboard widgets — lending pool, assets, outstanding loans
Files: `src/components/dashboard/OwnerDashboard.tsx`, `src/components/dashboard/MemberDashboard.tsx` (using `computeLendingPoolAvailable`/`computeAssetsValue` from chunk 3).
Deps: 3 (works with zero loans — pool = full allocation); 9 for outstanding-principal accuracy.
Test: on a circle with no loans, confirm "Lending Pool Available" = total contributions × `loan_allocation_pct`; after issuing/repaying a loan from chunks 8-9, confirm the number decreases/increases correctly; confirm 2-col mobile / 4-col desktop grid and dark mode.

### 15. Migration 0003 — `cycle_asset_records` + RLS
Files: `supabase/migrations/0003_cycle_asset_records.sql`, `supabase/seed.sql`.
Deps: 1.
Test: run seed; insert a row via SQL as admin — succeeds; as a regular member confirm SELECT works (transparency — all members can view) but INSERT/UPDATE is blocked by `car_insert_admin_or_owner`/`car_update_admin_or_owner`.

### 16. Asset allocation log — `addCycleAssetRecord`/`updateAssetRecordValue` + UI + cycle-close hook
Files: `src/lib/actions.ts` (`addCycleAssetRecord`, `updateAssetRecordValue`), `src/components/settlement/AssetRecordForm.tsx`, `src/components/settlement/AssetRecordList.tsx`, integration into the cycle-close flow (wherever `closeCycle` is triggered).
Deps: 15.
Test: close a cycle, confirm the suggested asset amount shown = cycle total collected × `asset_allocation_pct`; submit an asset record (e.g. "Recurring Deposit", "SBI", amount) — confirm row created + `cycle_asset_recorded` audit entry; later call `updateAssetRecordValue` to set `current_value` — confirm `asset_record_revalued` audit entry; confirm all members (not just admins) can view `AssetRecordList` on the settlement page.

### 17. Migration 0004 — settlement tables + RLS + `lib/settlement.ts`
Files: `supabase/migrations/0004_circle_settlement.sql`, `supabase/seed.sql`, `src/lib/settlement.ts` (`computeMemberShare`).
Deps: 1.
Test: run seed; insert a `circle_settlements` row + a couple `circle_settlement_payouts` rows via SQL for different `contribution_total` values, confirm `computeMemberShare` produces shares proportional to contribution and summing (across all members) to `total_value`; confirm RLS — a member can SELECT their own payout row but not another member's (admin can see all).

### 18. Settlement calculation — `calculateCircleSettlement`/`finalizeCircleSettlement` + UI + `/settlement` page
Files: `src/lib/actions.ts` (`calculateCircleSettlement`, `finalizeCircleSettlement`), `src/components/settlement/SettlementSummary.tsx`, `src/components/settlement/SettlementPayoutTable.tsx`, `src/app/(app)/circles/[circleId]/settlement/page.tsx`.
Deps: 9 (loans must be closeable to unblock), 16 (asset values feed the suggested `total_value`), 17.
Test: on a circle with an active (non-terminal) loan, confirm `calculateCircleSettlement` returns an error naming the blocking loan; close that loan (chunk 9), retry — confirm draft settlement created with `total_value` suggestion = contributions + loan interest + asset value deltas, editable via `totalValueOverride`; confirm a late-joining member (fewer lifetime contributions) gets a proportionally smaller `share_amount`; call `finalizeCircleSettlement` — confirm `status='finalized'` and `fund_circles.status='closed'`, and that recalculation is blocked after finalize.

### 19. Settlement disbursement tracking + dashboard banner
Files: `src/lib/actions.ts` (`recordSettlementDisbursement`), disbursement controls in `SettlementPayoutTable.tsx`, a banner/card in `OwnerDashboard.tsx`/`MemberDashboard.tsx` linking to `/settlement` when `end_date` is within 30 days or passed.
Deps: 18.
Test: as admin, mark one member's payout as disbursed — confirm `disbursed=true`, `disbursed_at`/`disbursed_by` set, `settlement_payout_disbursed` audit entry; confirm that member's own settlement page view reflects "disbursed" status; confirm the dashboard banner appears for a circle whose `end_date` is ≤30 days away and links correctly.
