# Member exit flow + managed chip cleanup

**Date:** 2026-06-25
**Scope:** `src/components/members/MemberTable.tsx`, `src/app/(app)/circles/[circleId]/members/page.tsx`, `src/lib/actions.ts`

## Problem

Two issues on the circle Members screen:

1. **Two stacked chips look bad.** Managed members render a role badge (`member`) and a separate `Managed` badge stacked vertically (`MemberTable.tsx:96-107`).
2. **Members can be deleted carelessly.** The trash icon calls `removeCircleMember` directly — no confirmation, no check for money or commitments. `removeCircleMember` (`actions.ts:349`) merely soft-deletes (`active:false`). A member who has contributed money or owes dues/loans should never be removable; their record is permanent.

## Principles

A member who has touched the fund's money is a permanent part of the ledger. There is **no archive and no delete** for them — transparency requires the record stay intact and visible. Removal exists only to undo mistakes: members who never had any money or commitment attached.

## Financial footprint (computed server-side, never trusted from client)

Per member, derived from authoritative tables scoped to the circle:

- **`hasPaidHistory`** — any `contributions.paid_amount > 0` for the member in this circle (including closed cycles). Contributions join `contribution_cycles` on `fund_circle_id = circleId`.
- **`hasOutstandingDues`** — any contribution in an **open** cycle (`contribution_cycles.status = 'open'`) where `paid_amount < expected_amount + late_fee`.
- **`hasActiveLoan`** — any `loans` row for the member in this circle with `status IN ('pending_request','active')`.

`hasFootprint = hasPaidHistory || hasOutstandingDues || hasActiveLoan`

## Two exit states

| State | Condition | UI | Action |
|---|---|---|---|
| **Removable** | `!hasFootprint` (and not the only owner / role !== owner, unchanged) | Trash icon → confirm dialog | Hard delete via `deleteCircleMemberPermanently` |
| **Locked** | `hasFootprint` | Lock/info icon → dialog explaining why | None — member stays |

The Locked dialog tailors its message:
- Outstanding dues → "Has outstanding dues in an open cycle."
- Active/pending loan → "Has an active loan."
- History only → "Has contribution history — kept for the record."
(If more than one applies, list each reason.)

Owner rows keep the existing rule: the only owner / `role === 'owner'` is never removable (already enforced).

## Server actions (`lib/actions.ts`)

- **Retire `removeCircleMember`'s soft-delete role.** Replace its single call site (MemberTable) with the new action below. (Remove the function if nothing else references it; verify with a grep first.)
- **New `deleteCircleMemberPermanently(circleId, userId, actorUserId)`:**
  1. Re-check actor is admin/owner of the circle (server-side, do not trust UI gate).
  2. Recompute footprint server-side. If `hasFootprint`, return `{ success:false, error:"This member has financial records and can't be removed." }`.
  3. Refuse if target `role === 'owner'`.
  4. Delete the `fund_circle_members` row (`fund_circle_id`, `user_id`).
  5. **Managed-profile cleanup:** if the target profile `is_managed = true`, is not linked to an auth user, and has no other `fund_circle_members` rows, delete the `profiles` row too. Real-account profiles/auth are never touched.
  6. `writeAuditLog({ action: "member_deleted_from_circle", entityType: "fund_circle_member", newValue: { userId } })`.
  7. `revalidatePath('/circles/${circleId}/members')`.

Returns `ActionResult`. All expected failures are discriminated results, not throws.

## Data layer (`members/page.tsx`)

Extend the existing member-building loop to attach footprint flags. Add queries after the profile fetch:

- Contributions: select `user_id, paid_amount, expected_amount, late_fee, contribution_cycles!inner(status, fund_circle_id)` filtered to `fund_circle_id = circleId` and `user_id IN userIds`. Reduce per user into `hasPaidHistory` and `hasOutstandingDues`.
- Loans: select `user_id, status` where `fund_circle_id = circleId`, `user_id IN userIds`, `status IN ('pending_request','active')`. Reduce into `hasActiveLoan`.

Pass `hasPaidHistory`, `hasOutstandingDues`, `hasActiveLoan` through the `Member` shape to `MemberTable`.

## UI (`MemberTable.tsx`)

- **Managed chip:** when `m.isManaged`, render a single combined chip (`UserCog` icon + "Managed") in place of the role badge. Non-managed members keep their existing role badge. Role stays editable via the dropdown below regardless.
- **Removal control:**
  - Removable member: existing trash button, but `onClick` opens a confirm dialog (using `components/ui/dialog`) summarizing the specific member ("Remove Priya Nair from this circle? This permanently deletes them. This member has no payments, dues, or loans."). Confirm → `deleteCircleMemberPermanently` → `router.refresh()`.
  - Locked member: replace trash with a lock/info icon button; tapping opens a dialog listing the reason(s) and stating the member can't be removed.
- Owner row: control hidden/disabled as today.
- Loading state per `userId` preserved.

## Constraints honored

- Server action re-checks role + footprint (RLS-style defense, not trusting UI).
- Audit log written for the financial-entity mutation.
- Confirmation dialog summarizes the specific change, not a generic prompt.
- Mobile-friendly: tap-to-open dialog, no hover-only tooltips for the Locked explanation.
- No `any`; `ActionResult` return; dark mode + 360px verified on the touched page.

## Out of scope

- No changes to contribution/loan/cycle logic.
- No bulk member operations.
- No re-add flow for a previously deleted member (they can be re-invited normally).
