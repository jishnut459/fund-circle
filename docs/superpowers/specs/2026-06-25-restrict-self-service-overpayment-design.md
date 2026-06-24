# Restrict member self-service overpayment

## Problem

Members can submit a contribution payment for verification via the "Mark as paid" dialog (`SubmitPaymentDialog` → `submitContributionPayment`). The amount field accepts any positive number — there is no check, client or server side, that the amount doesn't exceed what's actually owed (`expected_amount + late_fee − paid_amount`). A member can submit, and an admin can then verify, a payment that pushes the contribution into an unintended `overpaid` state.

## Scope

- **In scope**: `submitContributionPayment` (server action, `src/lib/actions.ts`) and `SubmitPaymentDialog` (`src/components/contributions/SubmitPaymentDialog.tsx`).
- **Out of scope**: `editContributionPayment` (admin Record/Edit Payment) and `verifyContributionPayment` (admin Verify pending payment). Admins retain the ability to record a genuine overpayment (e.g. a member sent extra in real life) — this is what feeds the existing `overpaid` status badge, border color, and dashboard metric (CLAUDE.md §5, §7). This change only restricts what a member can *propose* via self-service, not what an admin can *confirm* actually happened.
- No schema, RLS, or migration changes — this is a validation-only change against existing columns.

## Design

### Server: `submitContributionPayment`

Currently selects only `user_id, paid_amount, contribution_cycle_id` from `contributions` and never checks the proposed amount against what's owed.

Change:
1. Extend the `contributions` select to include `expected_amount, late_fee`.
2. Extend the `contribution_cycles` select to include `due_date`.
3. Call the existing `resolveContributionLateFee(supabase, circleId, cycle.due_date, Number(contrib.late_fee))` helper (already used identically by `verifyContributionPayment` and `editContributionPayment`) to get the live late fee that would apply if this were verified right now.
4. Compute `remaining = roundCurrency(Number(contrib.expected_amount) + lateFee - Number(contrib.paid_amount))`.
5. If `amount > remaining`, return `{ success: false, error: "This amount exceeds the ₹{remaining} remaining for this contribution." }` (via `formatCurrency`, matching the existing loan-eligibility error message convention in the same file) and do not insert the pending `contribution_payments` row.

This is a server-side re-check, not just a UI gate, per the project's architecture rule that server actions must never assume the UI gate was respected.

Because `resolveContributionLateFee` only ever returns a late fee equal to or greater than the contribution's currently stored `late_fee` (it escalates from 0 to the circle's configured fee once overdue, never down), the server-computed `remaining` will always be ≥ what the client displays using the stored `late_fee`. So a member who submits exactly what the dialog shows as "remaining" will never be incorrectly rejected by this stricter server check.

### Client: `SubmitPaymentDialog`

Already computes `remaining = (expectedAmount + lateFee) - currentPaid` for display purposes.

Change: add a validation alongside the existing `amount <= 0` check —
- When `Number(amount) > remaining`, disable the submit button and show an inline message: `Amount can't exceed the ₹{remaining} remaining.`
- This mirrors the existing inline-error pattern already in the component (the `error` state shown above the submit button).

## Out of scope / explicitly not changing

- `editContributionPayment` and `verifyContributionPayment` — unchanged, admins can still confirm overpayment.
- The `overpaid` status, badge, and dashboard metric — remain reachable via admin action.
- No change to how late fees are calculated or persisted.

## Testing

- Manual: as a member, open "Mark as paid" on a contribution with a partial balance remaining; verify typing an amount above the remaining balance disables submit and shows the inline error; verify typing exactly the remaining amount (or less) submits successfully.
- Manual: attempt to bypass the UI cap by calling `submitContributionPayment` directly with an amount above remaining (e.g. via a quick script or by temporarily removing the client check) and confirm the server rejects it.
- Confirm admin Record/Edit Payment and Verify flows are unaffected — an admin can still mark a contribution as paid above the expected amount.
