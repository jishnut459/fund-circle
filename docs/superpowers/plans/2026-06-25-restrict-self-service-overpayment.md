# Restrict Member Self-Service Overpayment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prevent members from submitting a self-service contribution payment for an amount greater than what's actually remaining (`expected_amount + late_fee − paid_amount`), while leaving admin record/edit/verify flows (and the `overpaid` status they feed) untouched.

**Architecture:** Add a server-side balance check to `submitContributionPayment` in `src/lib/actions.ts` using the same `resolveContributionLateFee` helper the admin verify/edit actions already use, so the cap reflects the live amount due. Mirror the same cap client-side in `SubmitPaymentDialog.tsx` to disable submission and show an inline message before the request is even made.

**Tech Stack:** Next.js Server Actions, TypeScript (strict), Supabase (admin client), existing `formatCurrency`/`roundCurrency` helpers.

## Global Constraints

- This repository has no test framework installed (no Jest/Vitest/Playwright unit tests anywhere in the repo) — do not add one. Verification is via `npx tsc --noEmit`, `npm run lint`, and manual browser checks, matching the existing AGENTS.md workflow checklist.
- TypeScript strict mode — no `any`.
- Server actions return `ActionResult<T>` (`{success:true,data:T}|{success:false,error:string}`) for expected failures — never throw.
- Currency formatting goes through `formatCurrency` from `lib/format.ts`.
- Out of scope, must remain unchanged: `editContributionPayment`, `verifyContributionPayment`, the `overpaid` status/badge/dashboard metric.
- No schema, RLS, or migration changes.
- Don't reformat unrelated code in either file.

---

## File Structure

- Modify: `src/lib/actions.ts` — function `submitContributionPayment` (currently lines 520-571). Adds a server-side remaining-balance check before the pending payment row is inserted.
- Modify: `src/components/contributions/SubmitPaymentDialog.tsx` — adds a derived `exceedsRemaining` check that disables submit and shows an inline message.

No new files.

---

### Task 1: Server-side cap in `submitContributionPayment`

**Files:**
- Modify: `src/lib/actions.ts:520-571`

**Interfaces:**
- Consumes: `resolveContributionLateFee(supabase, circleId, dueDate, existingLateFee)` — already defined at `src/lib/actions.ts:502-518` in the same file, returns `Promise<number>`. `roundCurrency` (from `@/lib/loans`) and `formatCurrency` (from `@/lib/format`) — both already imported at the top of `src/lib/actions.ts`.
- Produces: no change to the function's public signature — `submitContributionPayment(contributionId: string, amount: number, notes: string, userId: string, circleId: string): Promise<ActionResult>` stays the same. Callers (`SubmitPaymentDialog.tsx`) are unaffected by the signature.

- [ ] **Step 1: Replace the function body to add the remaining-balance check**

Replace the current `submitContributionPayment` function:

```typescript
export async function submitContributionPayment(
  contributionId: string,
  amount: number,
  notes: string,
  userId: string,
  circleId: string
): Promise<ActionResult> {
  if (!contributionId || !amount || amount <= 0 || !userId || !circleId)
    return { success: false, error: "Missing required fields" }
  const supabase = createAdminSupabaseClient()
  const { data: contrib } = await supabase
    .from("contributions")
    .select("user_id, paid_amount, contribution_cycle_id")
    .eq("id", contributionId)
    .single()
  if (!contrib) return { success: false, error: "Contribution not found" }
  if (contrib.user_id !== userId) return { success: false, error: "You can only submit payments for your own contributions." }
  const { data: cycle } = await supabase
    .from("contribution_cycles")
    .select("fund_circle_id")
    .eq("id", contrib.contribution_cycle_id)
    .single()
  if (!cycle || cycle.fund_circle_id !== circleId) return { success: false, error: "Contribution not found" }
  // Closed cycles still accept payments so members can settle previous cycles late.
  const { data: existing } = await supabase
    .from("contribution_payments")
    .select("id")
    .eq("contribution_id", contributionId)
    .eq("status", "pending")
    .maybeSingle()
  if (existing) return { success: false, error: "A payment is already pending verification for this contribution." }
  const { error } = await supabase.from("contribution_payments").insert({
    contribution_id: contributionId,
    amount,
    recorded_by: userId,
    submitted_by: userId,
    status: "pending",
    notes: notes || null,
  })
  if (error) return { success: false, error: "Failed to submit payment" }
  await writeAuditLog({
    circleId,
    userId,
    action: "payment_submitted",
    entityType: "contribution",
    entityId: contributionId,
    previousValue: { paid_amount: Number(contrib.paid_amount) },
    newValue: { submitted_amount: amount },
  })
  revalidatePath(`/circles/${circleId}/cycles`)
  return { success: true, data: undefined }
}
```

with:

```typescript
export async function submitContributionPayment(
  contributionId: string,
  amount: number,
  notes: string,
  userId: string,
  circleId: string
): Promise<ActionResult> {
  if (!contributionId || !amount || amount <= 0 || !userId || !circleId)
    return { success: false, error: "Missing required fields" }
  const supabase = createAdminSupabaseClient()
  const { data: contrib } = await supabase
    .from("contributions")
    .select("user_id, paid_amount, expected_amount, late_fee, contribution_cycle_id")
    .eq("id", contributionId)
    .single()
  if (!contrib) return { success: false, error: "Contribution not found" }
  if (contrib.user_id !== userId) return { success: false, error: "You can only submit payments for your own contributions." }
  const { data: cycle } = await supabase
    .from("contribution_cycles")
    .select("fund_circle_id, due_date")
    .eq("id", contrib.contribution_cycle_id)
    .single()
  if (!cycle || cycle.fund_circle_id !== circleId) return { success: false, error: "Contribution not found" }
  const lateFee = await resolveContributionLateFee(supabase, circleId, cycle.due_date, Number(contrib.late_fee))
  const remaining = roundCurrency(Number(contrib.expected_amount) + lateFee - Number(contrib.paid_amount))
  if (amount > remaining)
    return { success: false, error: `This amount exceeds the ${formatCurrency(remaining)} remaining for this contribution.` }
  // Closed cycles still accept payments so members can settle previous cycles late.
  const { data: existing } = await supabase
    .from("contribution_payments")
    .select("id")
    .eq("contribution_id", contributionId)
    .eq("status", "pending")
    .maybeSingle()
  if (existing) return { success: false, error: "A payment is already pending verification for this contribution." }
  const { error } = await supabase.from("contribution_payments").insert({
    contribution_id: contributionId,
    amount,
    recorded_by: userId,
    submitted_by: userId,
    status: "pending",
    notes: notes || null,
  })
  if (error) return { success: false, error: "Failed to submit payment" }
  await writeAuditLog({
    circleId,
    userId,
    action: "payment_submitted",
    entityType: "contribution",
    entityId: contributionId,
    previousValue: { paid_amount: Number(contrib.paid_amount) },
    newValue: { submitted_amount: amount },
  })
  revalidatePath(`/circles/${circleId}/cycles`)
  return { success: true, data: undefined }
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors mentioning `submitContributionPayment` or `src/lib/actions.ts`.

- [ ] **Step 3: Lint**

Run: `npm run lint`
Expected: no new warnings/errors in `src/lib/actions.ts`.

- [ ] **Step 4: Commit**

```bash
git add src/lib/actions.ts
git commit -m "Cap member self-service payment submissions at the remaining balance"
```

---

### Task 2: Client-side cap in `SubmitPaymentDialog`

**Files:**
- Modify: `src/components/contributions/SubmitPaymentDialog.tsx`

**Interfaces:**
- Consumes: `formatCurrency(amount: number): string` (already imported in this file from `@/lib/format`). The `remaining` variable already computed in this component at line 46 (`const remaining = totalDue - currentPaid`).
- Produces: no prop or export changes — `SubmitPaymentDialog`'s props stay identical, so `ContributionTable.tsx` (its only caller) needs no changes.

- [ ] **Step 1: Add the derived `exceedsRemaining` check**

In `src/components/contributions/SubmitPaymentDialog.tsx`, find:

```typescript
  const totalDue = expectedAmount + lateFee
  const remaining = totalDue - currentPaid
```

Replace with:

```typescript
  const totalDue = expectedAmount + lateFee
  const remaining = totalDue - currentPaid
  const exceedsRemaining = amount !== "" && Number(amount) > remaining
  const remainingExceededMessage = `Amount can't exceed the ${formatCurrency(remaining)} remaining.`
```

- [ ] **Step 2: Guard `handleSubmit` against the same condition**

Find:

```typescript
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!amount || Number(amount) <= 0) return
```

Replace with:

```typescript
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!amount || Number(amount) <= 0 || exceedsRemaining) return
```

- [ ] **Step 3: Show the inline message under the amount field and disable submit**

Find:

```typescript
          <div className="space-y-2">
            <Label htmlFor="sp-amount">Amount paid (₹)</Label>
            <Input id="sp-amount" type="number" step="0.01" min="0" value={amount}
              onChange={(e) => setAmount(e.target.value)} onFocus={(e) => e.target.select()}
              placeholder="500" disabled={loading} autoFocus />
          </div>
```

Replace with:

```typescript
          <div className="space-y-2">
            <Label htmlFor="sp-amount">Amount paid (₹)</Label>
            <Input id="sp-amount" type="number" step="0.01" min="0" value={amount}
              onChange={(e) => setAmount(e.target.value)} onFocus={(e) => e.target.select()}
              placeholder="500" disabled={loading} autoFocus />
            {exceedsRemaining && <p className="text-sm text-red-600">{remainingExceededMessage}</p>}
          </div>
```

Find:

```typescript
          <Button type="submit" disabled={loading || !amount || Number(amount) <= 0} className="w-full">
            {loading ? "Submitting..." : "Submit for Verification"}
          </Button>
```

Replace with:

```typescript
          <Button type="submit" disabled={loading || !amount || Number(amount) <= 0 || exceedsRemaining} className="w-full">
            {loading ? "Submitting..." : "Submit for Verification"}
          </Button>
```

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors mentioning `SubmitPaymentDialog.tsx`.

- [ ] **Step 5: Lint**

Run: `npm run lint`
Expected: no new warnings/errors in `SubmitPaymentDialog.tsx`.

- [ ] **Step 6: Commit**

```bash
git add src/components/contributions/SubmitPaymentDialog.tsx
git commit -m "Disable self-service payment submit when amount exceeds remaining balance"
```

---

### Task 3: Manual end-to-end verification

**Files:** none (verification only)

**Interfaces:** none — this task exercises Task 1 + Task 2 together through the running app.

- [ ] **Step 1: Start the dev server**

Run: `npm run dev`
Expected: server starts on its default port without errors.

- [ ] **Step 2: As a member, open a contribution with a partial balance remaining**

Navigate to `/circles/[circleId]/cycles/[cycleId]` while signed in as a non-admin member with a `partially_paid` (or `unpaid`) contribution row. Expand the row and click "Mark as paid".

- [ ] **Step 3: Verify over-the-remaining amount is blocked**

Type an amount greater than the "Remaining" value shown in the dialog summary. Confirm:
- An inline red message appears: "Amount can't exceed the ₹X remaining."
- The "Submit for Verification" button is disabled.

- [ ] **Step 4: Verify exact-remaining amount still submits**

Clear the field and click "Use remaining amount" (or type the exact remaining value). Confirm:
- No inline error.
- Submit succeeds and shows the "Payment of ₹X submitted — awaiting admin verification" toast.

- [ ] **Step 5: Verify the server rejects a bypassed client check**

With the same or another partially-paid contribution, call the server action directly above the remaining balance to confirm server-side enforcement independent of the UI — e.g. temporarily comment out the `exceedsRemaining` guard in `handleSubmit` (Task 2, Step 2) in a local-only edit, attempt to submit an over-the-remaining amount through the dialog, and confirm the toast/error shows "This amount exceeds the ₹X remaining for this contribution." instead of succeeding. Revert the temporary edit afterward (`git checkout -- src/components/contributions/SubmitPaymentDialog.tsx` if no other uncommitted changes are in that file, otherwise manually restore the guard).

- [ ] **Step 6: Verify admin flows are unaffected**

Sign in as an admin/owner. Confirm:
- "Record payment" / "Edit" (`EditPaymentDialog`) still accepts any amount, including one that results in an `overpaid` status.
- Verifying a pending submission (`VerifyPaymentActions`) still works normally for amounts within the cap (since Task 1 prevents over-cap submissions from ever reaching pending state).

- [ ] **Step 7: Verify dark mode and mobile (360px)**

Resize the browser (or use device emulation) to 360px width and toggle dark mode. Confirm the new inline error message is readable and doesn't break the dialog layout in either mode.

---

## Self-Review Notes

- **Spec coverage:** Server-side cap (spec §Design/Server) → Task 1. Client-side cap (spec §Design/Client) → Task 2. Out-of-scope guarantees (admin flows untouched) → Task 3 Step 6. Manual testing plan from spec §Testing → Task 3 Steps 2-5.
- **Placeholder scan:** none found — every step has literal before/after code or an exact command with expected output.
- **Type consistency:** `submitContributionPayment`'s signature is unchanged across Task 1 and its only caller in `SubmitPaymentDialog.tsx` (Task 2), so no caller updates are needed. `remaining`, `exceedsRemaining`, and `remainingExceededMessage` names are used consistently within Task 2's steps.
