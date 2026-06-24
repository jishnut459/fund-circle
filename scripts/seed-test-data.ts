/**
 * Seed three realistic Fund Circle test circles for tester onboarding.
 *
 * Run with:  npm run seed:test   (loads .env.local, points at the REMOTE project)
 *
 * Prerequisites:
 *  1. The OWNER (you) must have signed in to the app at least once, so an
 *     auth.users + profiles row exists for OWNER_EMAIL. Every admin-attributed
 *     historical action (recorded_by / verified_by / reviewed_by / calculated_by /
 *     audit user) is FK'd to auth.users and is attributed to that account.
 *  2. Fill in real Google emails in the TESTERS config below. Each tester is
 *     created as a managed (offline) member; on their first Google sign-in the
 *     app re-keys their full history + role onto their real account
 *     (resolveUserOnSignIn -> rekeyManagedMember).
 *
 * Safe to re-run: it deletes the previously-seeded circles (by fixed id) and
 * their managed members first, then recreates everything.
 */
import { generateAmortizationSchedule, roundCurrency } from "../src/lib/loans"
import { getCyclePeriod, toISODate, type CyclePeriod } from "../src/lib/cycles"
import { createClient, type SupabaseClient } from "@supabase/supabase-js"

// ---------------------------------------------------------------------------
// CONFIG — edit before running
// ---------------------------------------------------------------------------

type Role = "owner" | "admin" | "member"

// The real account that owns + records the seed. Must already have signed in.
const OWNER_EMAIL = "jishnut459@gmail.com"

// Your (owner account's) role in each circle, by circle index. You are the
// recording actor everywhere regardless of role. This gives you an owner
// experience (C1, C2) and a plain-member experience (C3).
const OWNER_ROLE_BY_CIRCLE: Role[] = ["owner", "owner", "member"]

/**
 * Managed testers — created as offline members now, claimed on first Google
 * sign-in (resolveUserOnSignIn -> rekeyManagedMember). `roles[ci]` is the role
 * in circle index `ci`. Every circle must end up with exactly one owner across
 * the owner account + testers (validated at runtime).
 */
const TESTERS: { name: string; email: string; roles: Role[] }[] = [
  { name: "Saumya", email: "gsaumya106@gmail.com", roles: ["member", "admin", "owner"] },
]

// Fixed circle ids so re-runs can clean up deterministically.
const CIRCLE_IDS = [
  "11111111-1111-4111-8111-111111111111",
  "22222222-2222-4222-8222-222222222222",
  "33333333-3333-4333-8333-333333333333",
] as const

// ---------------------------------------------------------------------------
// Small utilities
// ---------------------------------------------------------------------------

const uuid = (): string => globalThis.crypto.randomUUID()

const NOW = new Date()
const iso = (d: Date): string => d.toISOString()

function addMonths(d: Date, months: number): Date {
  return new Date(d.getFullYear(), d.getMonth() + months, d.getDate())
}
function addDays(d: Date, days: number): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + days)
}
function monthsAgo(n: number): Date {
  return addMonths(NOW, -n)
}

type PgError = { message: string } | null
function check(label: string, error: PgError): void {
  if (error) throw new Error(`${label}: ${error.message}`)
}

// ---------------------------------------------------------------------------
// Circle definitions
// ---------------------------------------------------------------------------

type CircleConfig = {
  id: string
  name: string
  description: string
  contribution_amount: number
  contribution_frequency: "daily" | "weekly" | "monthly" | "quarterly"
  cycle_due_day: number | null
  subscription_plan: "free" | "pro" | "premium"
  max_members: number
  asset_allocation_pct: number
  loan_allocation_pct: number
  loan_interest_rate_pct: number
  max_loan_pct_of_contribution: number
  max_loan_pct_of_lending_pool: number
  contribution_late_fee: number
  contribution_grace_days: number
  loan_late_fee: number
  loan_grace_days: number
  start_date: string | null
  end_date: string | null
  fillerNames: string[]
  pastCycleCount: number
}

const CIRCLES: CircleConfig[] = [
  {
    id: CIRCLE_IDS[0],
    name: "Sunrise Monthly Savings",
    description: "A monthly community savings fund with internal lending.",
    contribution_amount: 2000,
    contribution_frequency: "monthly",
    cycle_due_day: 5,
    subscription_plan: "pro",
    max_members: 100,
    asset_allocation_pct: 0,
    loan_allocation_pct: 100,
    loan_interest_rate_pct: 12,
    max_loan_pct_of_contribution: 90,
    max_loan_pct_of_lending_pool: 25,
    contribution_late_fee: 50,
    contribution_grace_days: 3,
    loan_late_fee: 100,
    loan_grace_days: 5,
    start_date: null,
    end_date: null,
    fillerNames: ["Ramesh Iyer", "Sunita Rao", "Arjun Mehta"],
    pastCycleCount: 4,
  },
  {
    id: CIRCLE_IDS[1],
    name: "Aishwarya Wedding Fund",
    description: "A fixed-term quarterly wedding fund split between assets and lending.",
    contribution_amount: 5000,
    contribution_frequency: "quarterly",
    cycle_due_day: 10,
    subscription_plan: "free",
    max_members: 20,
    asset_allocation_pct: 60,
    loan_allocation_pct: 40,
    loan_interest_rate_pct: 10,
    max_loan_pct_of_contribution: 80,
    max_loan_pct_of_lending_pool: 30,
    contribution_late_fee: 0,
    contribution_grace_days: 0,
    loan_late_fee: 0,
    loan_grace_days: 0,
    start_date: toISODate(monthsAgo(12)),
    end_date: toISODate(addMonths(NOW, 12)),
    fillerNames: ["Priya Nair", "Karan Singh"],
    pastCycleCount: 3,
  },
  {
    id: CIRCLE_IDS[2],
    name: "Grameen Welfare Association",
    description: "A weekly welfare association with asset reserves and member loans.",
    contribution_amount: 500,
    contribution_frequency: "weekly",
    cycle_due_day: 5, // Friday
    subscription_plan: "premium",
    max_members: 9999,
    asset_allocation_pct: 30,
    loan_allocation_pct: 70,
    loan_interest_rate_pct: 18,
    max_loan_pct_of_contribution: 90,
    max_loan_pct_of_lending_pool: 20,
    contribution_late_fee: 20,
    contribution_grace_days: 1,
    loan_late_fee: 50,
    loan_grace_days: 3,
    start_date: null,
    end_date: null,
    fillerNames: ["Lakshmi Devi", "Vikram Patel", "Meena Kumari", "Suresh Babu", "Anita Joshi"],
    pastCycleCount: 6,
  },
]

/** Role of the owner account in a given circle. */
function ownerRole(circleIndex: number): Role {
  return OWNER_ROLE_BY_CIRCLE[circleIndex] ?? "owner"
}

// ---------------------------------------------------------------------------
// Row builders / inserters
// ---------------------------------------------------------------------------

type Member = { id: string; name: string; kind: "owner" | "tester" | "filler" }

const auditRows: Record<string, unknown>[] = []
function audit(circleId: string, ownerId: string, action: string, entityType: string, entityId: string, newValue: Record<string, unknown>, createdAt: Date): void {
  auditRows.push({
    id: uuid(),
    circle_id: circleId,
    user_id: ownerId,
    action,
    entity_type: entityType,
    entity_id: entityId,
    previous_value: null,
    new_value: newValue,
    created_at: iso(createdAt),
  })
}

// --- contribution outcome model ---
type Outcome = "paid" | "partial" | "unpaid" | "overpaid" | "late"
const OUTCOME_ROTATION: Outcome[] = ["paid", "paid", "late", "partial", "paid", "overpaid", "unpaid", "paid"]

type ContribResult = {
  paidAmount: number
  lateFee: number
  paymentDate: string | null
  payment: { amount: number; date: string } | null
}

function computeOutcome(expected: number, lateFeeAmount: number, dueDateIso: string, graceDays: number, type: Outcome): ContribResult {
  const onTime = addDays(new Date(dueDateIso), -1)
  switch (type) {
    case "paid":
      return { paidAmount: expected, lateFee: 0, paymentDate: toISODate(onTime), payment: { amount: expected, date: toISODate(onTime) } }
    case "partial": {
      const amt = roundCurrency(expected * 0.5)
      return { paidAmount: amt, lateFee: 0, paymentDate: toISODate(onTime), payment: { amount: amt, date: toISODate(onTime) } }
    }
    case "unpaid":
      return { paidAmount: 0, lateFee: 0, paymentDate: null, payment: null }
    case "overpaid": {
      const amt = roundCurrency(expected + Math.max(100, expected * 0.1))
      return { paidAmount: amt, lateFee: 0, paymentDate: toISODate(onTime), payment: { amount: amt, date: toISODate(onTime) } }
    }
    case "late": {
      const lateDate = addDays(new Date(dueDateIso), graceDays + 4)
      const amt = roundCurrency(expected + lateFeeAmount)
      return { paidAmount: amt, lateFee: lateFeeAmount, paymentDate: toISODate(lateDate), payment: { amount: amt, date: toISODate(lateDate) } }
    }
  }
}

/** Build the past + current cycle periods for a circle, oldest first. */
function buildPeriods(cfg: CircleConfig): { period: CyclePeriod; status: "open" | "closed" }[] {
  const out: { period: CyclePeriod; status: "open" | "closed" }[] = []
  const stepBack = (n: number): Date => {
    if (cfg.contribution_frequency === "weekly") return addDays(NOW, -7 * n)
    if (cfg.contribution_frequency === "quarterly") return addMonths(NOW, -3 * n)
    return addMonths(NOW, -n) // monthly / daily fallback
  }
  for (let k = cfg.pastCycleCount; k >= 1; k--) {
    out.push({ period: getCyclePeriod(cfg.contribution_frequency, stepBack(k), cfg.cycle_due_day), status: "closed" })
  }
  out.push({ period: getCyclePeriod(cfg.contribution_frequency, NOW, cfg.cycle_due_day), status: "open" })
  return out
}

// ---------------------------------------------------------------------------
// Loan seeding
// ---------------------------------------------------------------------------

type LoanSpec = {
  circleId: string
  borrowerId: string
  requesterId: string
  ownerId: string
  principal: number
  termMonths: number
  ratePct: number
  purpose: string
  status: "pending_request" | "active" | "closed"
  issueDate: Date | null
  installmentPlan?: ("full" | "partial" | "none")[] // length termMonths, for active/closed
  closeWithLumpSum?: { type: "foreclosure" | "prepayment"; regularCount: number; strategy?: "reduce_emi" | "reduce_tenure" }
}

type LoanBatch = {
  loans: Record<string, unknown>[]
  installments: Record<string, unknown>[]
  payments: Record<string, unknown>[]
}

function buildLoan(spec: LoanSpec, batch: LoanBatch): void {
  const loanId = uuid()
  const reviewedAt = spec.issueDate ? iso(spec.issueDate) : null

  if (spec.status === "pending_request" || !spec.issueDate) {
    batch.loans.push({
      id: loanId,
      fund_circle_id: spec.circleId,
      user_id: spec.borrowerId,
      status: "pending_request",
      requested_amount: spec.principal,
      requested_term_months: spec.termMonths,
      approved_amount: null,
      approved_term_months: null,
      interest_rate_pct: null,
      purpose: spec.purpose,
      requested_by: spec.requesterId,
      reviewed_by: null,
      reviewed_at: null,
      issued_at: null,
      created_at: iso(addDays(NOW, -3)),
      updated_at: iso(addDays(NOW, -3)),
    })
    return
  }

  batch.loans.push({
    id: loanId,
    fund_circle_id: spec.circleId,
    user_id: spec.borrowerId,
    status: spec.status,
    requested_amount: spec.principal,
    requested_term_months: spec.termMonths,
    approved_amount: spec.principal,
    approved_term_months: spec.termMonths,
    interest_rate_pct: spec.ratePct,
    purpose: spec.purpose,
    requested_by: spec.requesterId,
    reviewed_by: spec.ownerId,
    reviewed_at: reviewedAt,
    issued_at: iso(spec.issueDate),
    created_at: iso(addDays(spec.issueDate, -2)),
    updated_at: iso(NOW),
  })

  const schedule = generateAmortizationSchedule(spec.principal, spec.ratePct, spec.termMonths, spec.issueDate)
  const plan = spec.installmentPlan ?? schedule.map(() => "full" as const)

  // For a lump-sum close, every installment ends up settled; the lump sum covers
  // the principal of the installments beyond `regularCount`.
  const lump = spec.closeWithLumpSum
  let lumpAmount = 0
  if (lump) {
    lumpAmount = roundCurrency(
      schedule.slice(lump.regularCount).reduce((s, r) => s + r.principalComponent, 0)
    )
  }

  schedule.forEach((row, idx) => {
    const installmentId = uuid()
    let paidAmount = 0
    const settledByLump = lump ? idx >= lump.regularCount : false
    const planState: "full" | "partial" | "none" = lump ? "full" : plan[idx]

    if (settledByLump) {
      paidAmount = row.totalDue
    } else if (planState === "full") {
      paidAmount = row.totalDue
    } else if (planState === "partial") {
      paidAmount = roundCurrency(row.totalDue * 0.4)
    }

    batch.installments.push({
      id: installmentId,
      loan_id: loanId,
      installment_number: row.installmentNumber,
      due_date: row.dueDate,
      principal_component: row.principalComponent,
      interest_component: row.interestComponent,
      total_due: row.totalDue,
      paid_amount: paidAmount,
      late_fee_applied: 0,
      created_at: iso(spec.issueDate as Date),
      updated_at: iso(NOW),
    })

    // Regular per-installment payment ledger rows (only for non-lump, paid ones)
    if (!settledByLump && (planState === "full" || planState === "partial")) {
      const payDate = planState === "full" ? row.dueDate : toISODate(addDays(new Date(row.dueDate), -2))
      batch.payments.push({
        id: uuid(),
        loan_installment_id: installmentId,
        loan_id: null,
        amount: paidAmount,
        payment_date: payDate,
        recorded_by: spec.ownerId,
        notes: null,
        created_at: iso(new Date(payDate)),
        status: "verified",
        payment_type: "regular",
        prepayment_strategy: null,
        submitted_by: spec.borrowerId,
        verified_by: spec.ownerId,
        verified_at: iso(new Date(payDate)),
        rejection_reason: null,
        accrued_interest: 0,
      })
    }
  })

  // Lump-sum close: the regular installments up to `regularCount` already got
  // per-installment payments in the loop above; here we add the single
  // loan-level foreclosure/prepayment row that settles everything after them.
  if (lump) {
    const closeDate = addMonths(spec.issueDate, lump.regularCount)
    batch.payments.push({
      id: uuid(),
      loan_installment_id: null,
      loan_id: loanId,
      amount: lumpAmount,
      payment_date: toISODate(closeDate),
      recorded_by: spec.ownerId,
      notes: lump.type === "foreclosure" ? "Loan foreclosed (full early settlement)" : "Prepayment toward principal",
      created_at: iso(closeDate),
      status: "verified",
      payment_type: lump.type,
      prepayment_strategy: lump.strategy ?? null,
      submitted_by: spec.borrowerId,
      verified_by: spec.ownerId,
      verified_at: iso(closeDate),
      rejection_reason: null,
      accrued_interest: 0,
    })
  }

  audit(spec.circleId, spec.ownerId, "loan_issued", "loan", loanId, { amount: spec.principal, termMonths: spec.termMonths, status: spec.status }, spec.issueDate)
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  // Validate config
  const placeholder = TESTERS.find((t) => t.email.endsWith("@example.com") || !t.email.includes("@"))
  if (placeholder) {
    throw new Error(
      `TESTERS still contains a placeholder email (${placeholder.email}). Edit scripts/seed-test-data.ts with real Google emails before running.`
    )
  }
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. Run via `npm run seed:test` (loads .env.local).")
  }

  const db: SupabaseClient = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } })

  // 1. Resolve owner (must already exist as a real signed-in account)
  const { data: ownerRow, error: ownerErr } = await db
    .from("profiles")
    .select("id, name")
    .eq("email", OWNER_EMAIL.toLowerCase())
    .eq("is_managed", false)
    .maybeSingle()
  check("lookup owner", ownerErr)
  if (!ownerRow) {
    throw new Error(
      `No real account found for ${OWNER_EMAIL}. Sign in to the app once with that Google account, then re-run.`
    )
  }
  const ownerId: string = ownerRow.id
  const ownerName: string = ownerRow.name ?? "Owner"
  console.log(`Owner resolved: ${ownerName} (${ownerId})`)

  // 2. Idempotent cleanup (order matters: audit logs -> managed profiles -> circles)
  console.log("Cleaning up any previous seed...")
  const circleIds: string[] = [...CIRCLE_IDS]
  check("delete audit_logs", (await db.from("audit_logs").delete().in("circle_id", circleIds)).error)
  check(
    "delete managed profiles (by circle)",
    (await db.from("profiles").delete().eq("is_managed", true).in("created_in_circle", circleIds)).error
  )
  check(
    "delete managed profiles (by tester email)",
    (await db.from("profiles").delete().eq("is_managed", true).in("email", TESTERS.map((t) => t.email.toLowerCase()))).error
  )
  check("delete circles", (await db.from("fund_circles").delete().in("id", circleIds)).error)

  // 3. Tester managed profiles (one per tester, shared across circles)
  const testerIds: string[] = TESTERS.map(() => uuid())
  const testerProfiles = TESTERS.map((t, i) => ({
    id: testerIds[i],
    email: t.email.toLowerCase(),
    name: t.name,
    is_managed: true,
    managed_by: ownerId,
    // Left null: circles don't exist yet at this point, and cleanup matches
    // testers by email. (Filler profiles set this since their circle exists.)
    created_in_circle: null,
  }))
  check("insert tester profiles", (await db.from("profiles").insert(testerProfiles)).error)
  console.log(`Created ${testerProfiles.length} managed tester profiles.`)

  // 4. Per-circle seeding
  for (let ci = 0; ci < CIRCLES.length; ci++) {
    const cfg = CIRCLES[ci]
    console.log(`\nSeeding circle: ${cfg.name}`)

    // 4a. circle row
    check(
      "insert circle",
      (
        await db.from("fund_circles").insert({
          id: cfg.id,
          name: cfg.name,
          description: cfg.description,
          contribution_amount: cfg.contribution_amount,
          contribution_frequency: cfg.contribution_frequency,
          cycle_due_day: cfg.cycle_due_day,
          subscription_plan: cfg.subscription_plan,
          max_members: cfg.max_members,
          status: "active",
          asset_allocation_pct: cfg.asset_allocation_pct,
          loan_allocation_pct: cfg.loan_allocation_pct,
          loan_interest_rate_pct: cfg.loan_interest_rate_pct,
          max_loan_pct_of_contribution: cfg.max_loan_pct_of_contribution,
          max_loan_pct_of_lending_pool: cfg.max_loan_pct_of_lending_pool,
          contribution_late_fee: cfg.contribution_late_fee,
          contribution_grace_days: cfg.contribution_grace_days,
          loan_late_fee: cfg.loan_late_fee,
          loan_grace_days: cfg.loan_grace_days,
          start_date: cfg.start_date,
          end_date: cfg.end_date,
          created_at: iso(monthsAgo(cfg.pastCycleCount + 1)),
        })
      ).error
    )

    // 4b. filler managed profiles for this circle
    const fillerProfiles = cfg.fillerNames.map((name) => ({
      id: uuid(),
      email: null,
      name,
      is_managed: true,
      managed_by: ownerId,
      created_in_circle: cfg.id,
    }))
    check("insert filler profiles", (await db.from("profiles").insert(fillerProfiles)).error)
    const fillerIds: string[] = fillerProfiles.map((f) => f.id)

    // 4c. assemble member list + memberships (explicit per-circle roles)
    const ownerRoleHere = ownerRole(ci)
    const testerRolesHere = TESTERS.map((t, ti) => ({ id: testerIds[ti], role: t.roles[ci] ?? "member" }))

    // Validate exactly one owner per circle (owner account + testers).
    const ownerCount = (ownerRoleHere === "owner" ? 1 : 0) + testerRolesHere.filter((t) => t.role === "owner").length
    if (ownerCount !== 1) {
      throw new Error(`Circle "${cfg.name}" must have exactly one owner; found ${ownerCount}. Fix OWNER_ROLE_BY_CIRCLE / TESTERS roles.`)
    }

    const members: Member[] = [
      { id: ownerId, name: ownerName, kind: "owner" },
      ...TESTERS.map((t, ti) => ({ id: testerIds[ti], name: t.name, kind: "tester" as const })),
      ...fillerProfiles.map((f) => ({ id: f.id, name: f.name as string, kind: "filler" as const })),
    ]
    const memberships = [
      { id: uuid(), fund_circle_id: cfg.id, user_id: ownerId, role: ownerRoleHere, joined_at: iso(monthsAgo(cfg.pastCycleCount + 1)), active: true },
      ...testerRolesHere.map((t) => ({ id: uuid(), fund_circle_id: cfg.id, user_id: t.id, role: t.role, joined_at: iso(monthsAgo(cfg.pastCycleCount)), active: true })),
      ...fillerProfiles.map((f) => ({ id: uuid(), fund_circle_id: cfg.id, user_id: f.id, role: "member", joined_at: iso(monthsAgo(cfg.pastCycleCount)), active: true })),
    ]
    check("insert memberships", (await db.from("fund_circle_members").insert(memberships)).error)

    // People who will sign in (claimable) and currently hold a plain member role
    // here — these are the best subjects for pending payment requests and loans,
    // so a real tester sees their own activity after claiming.
    const claimableMemberIds: string[] = [
      ...(ownerRoleHere === "member" ? [ownerId] : []),
      ...testerRolesHere.filter((t) => t.role === "member").map((t) => t.id),
    ]
    // Subjects for the 2 pending payment requests on the open cycle.
    const pendingTargets = new Set([...claimableMemberIds, ...fillerIds].slice(0, 2))
    // Loan subjects: active-loan borrower and pending-request requester (kept distinct).
    const loanPool = [...claimableMemberIds, ...fillerIds]
    const borrowerActive = loanPool[0] ?? fillerIds[0]
    const requesterPending = loanPool.find((id) => id !== borrowerActive) ?? fillerIds[0]

    // 4d. cycles + contributions + payments
    const periods = buildPeriods(cfg)
    const cycleRows: Record<string, unknown>[] = []
    const contribRows: Record<string, unknown>[] = []
    const paymentRows: Record<string, unknown>[] = []

    periods.forEach((p, cycleIndex) => {
      const cycleId = uuid()
      const dueDateIso = toISODate(p.period.dueDate)
      cycleRows.push({
        id: cycleId,
        fund_circle_id: cfg.id,
        label: p.period.label,
        cycle_start: toISODate(p.period.start),
        cycle_end: toISODate(p.period.end),
        due_date: dueDateIso,
        status: p.status,
        created_at: iso(p.period.start),
      })
      audit(cfg.id, ownerId, "cycle_started", "contribution_cycle", cycleId, { label: p.period.label }, p.period.start)

      const isOpen = p.status === "open"

      members.forEach((m, mi) => {
        const contributionId = uuid()
        const expected = cfg.contribution_amount

        if (isOpen) {
          // Open cycle: leave unpaid; a couple of members have a PENDING request awaiting verification.
          contribRows.push({
            id: contributionId,
            contribution_cycle_id: cycleId,
            user_id: m.id,
            expected_amount: expected,
            paid_amount: 0,
            late_fee: 0,
            payment_date: null,
          })
          if (pendingTargets.has(m.id)) {
            paymentRows.push({
              id: uuid(),
              contribution_id: contributionId,
              amount: expected,
              payment_date: toISODate(addDays(NOW, -1)),
              recorded_by: ownerId,
              notes: "Submitted via app, awaiting verification",
              status: "pending",
              submitted_by: m.id,
              verified_by: null,
              verified_at: null,
              rejection_reason: null,
            })
          }
          return
        }

        const outcome = OUTCOME_ROTATION[(mi + cycleIndex) % OUTCOME_ROTATION.length]
        const r = computeOutcome(expected, cfg.contribution_late_fee, dueDateIso, cfg.contribution_grace_days, outcome)
        contribRows.push({
          id: contributionId,
          contribution_cycle_id: cycleId,
          user_id: m.id,
          expected_amount: expected,
          paid_amount: r.paidAmount,
          late_fee: r.lateFee,
          payment_date: r.paymentDate,
        })
        if (r.payment) {
          paymentRows.push({
            id: uuid(),
            contribution_id: contributionId,
            amount: r.payment.amount,
            payment_date: r.payment.date,
            recorded_by: ownerId,
            notes: outcome === "late" ? "Paid after due date (late fee applied)" : null,
            status: "verified",
            submitted_by: m.id,
            verified_by: ownerId,
            verified_at: iso(new Date(r.payment.date)),
            rejection_reason: null,
          })
        }
      })
    })

    check("insert cycles", (await db.from("contribution_cycles").insert(cycleRows)).error)
    if (contribRows.length) check("insert contributions", (await db.from("contributions").insert(contribRows)).error)
    if (paymentRows.length) check("insert contribution_payments", (await db.from("contribution_payments").insert(paymentRows)).error)

    // 4e. loans — borrowerActive / requesterPending computed in 4c so a real
    // tester (or you, where you're a member) sees their own loan after claiming.
    const batch: LoanBatch = { loans: [], installments: [], payments: [] }

    if (ci === 0) {
      // C1: active (overdue middle installment), fully-repaid closed, pending request
      buildLoan({ circleId: cfg.id, borrowerId: borrowerActive, requesterId: borrowerActive, ownerId, principal: 10000, termMonths: 6, ratePct: cfg.loan_interest_rate_pct, purpose: "Home repair", status: "active", issueDate: addDays(monthsAgo(4), -10), installmentPlan: ["full", "full", "full", "none", "none", "none"] }, batch)
      buildLoan({ circleId: cfg.id, borrowerId: fillerIds[0], requesterId: fillerIds[0], ownerId, principal: 6000, termMonths: 4, ratePct: cfg.loan_interest_rate_pct, purpose: "School fees", status: "closed", issueDate: monthsAgo(6), installmentPlan: ["full", "full", "full", "full"] }, batch)
      buildLoan({ circleId: cfg.id, borrowerId: requesterPending, requesterId: requesterPending, ownerId, principal: 8000, termMonths: 6, ratePct: cfg.loan_interest_rate_pct, purpose: "Medical expense", status: "pending_request", issueDate: null }, batch)
    } else if (ci === 1) {
      // C2: active (partial latest installment), foreclosed closed, pending request
      buildLoan({ circleId: cfg.id, borrowerId: borrowerActive, requesterId: borrowerActive, ownerId, principal: 15000, termMonths: 6, ratePct: cfg.loan_interest_rate_pct, purpose: "Venue booking", status: "active", issueDate: monthsAgo(2), installmentPlan: ["full", "partial", "none", "none", "none", "none"] }, batch)
      buildLoan({ circleId: cfg.id, borrowerId: fillerIds[0], requesterId: fillerIds[0], ownerId, principal: 12000, termMonths: 8, ratePct: cfg.loan_interest_rate_pct, purpose: "Catering advance", status: "closed", issueDate: monthsAgo(5), closeWithLumpSum: { type: "foreclosure", regularCount: 3 } }, batch)
      buildLoan({ circleId: cfg.id, borrowerId: requesterPending, requesterId: requesterPending, ownerId, principal: 9000, termMonths: 5, ratePct: cfg.loan_interest_rate_pct, purpose: "Jewellery", status: "pending_request", issueDate: null }, batch)
    } else {
      // C3: active (overdue 2nd installment), prepayment-closed, pending request
      buildLoan({ circleId: cfg.id, borrowerId: borrowerActive, requesterId: borrowerActive, ownerId, principal: 5000, termMonths: 5, ratePct: cfg.loan_interest_rate_pct, purpose: "Livelihood tools", status: "active", issueDate: addDays(monthsAgo(2), -15), installmentPlan: ["full", "none", "none", "none", "none"] }, batch)
      buildLoan({ circleId: cfg.id, borrowerId: fillerIds[0], requesterId: fillerIds[0], ownerId, principal: 4000, termMonths: 6, ratePct: cfg.loan_interest_rate_pct, purpose: "Seed capital", status: "closed", issueDate: monthsAgo(4), closeWithLumpSum: { type: "prepayment", regularCount: 2, strategy: "reduce_tenure" } }, batch)
      buildLoan({ circleId: cfg.id, borrowerId: requesterPending, requesterId: requesterPending, ownerId, principal: 3000, termMonths: 4, ratePct: cfg.loan_interest_rate_pct, purpose: "Emergency", status: "pending_request", issueDate: null }, batch)
    }

    if (batch.loans.length) check("insert loans", (await db.from("loans").insert(batch.loans)).error)
    if (batch.installments.length) check("insert loan_installments", (await db.from("loan_installments").insert(batch.installments)).error)
    if (batch.payments.length) check("insert loan_payments", (await db.from("loan_payments").insert(batch.payments)).error)

    // pending-request audit
    audit(cfg.id, ownerId, "loan_requested", "loan", uuid(), { requestedBy: requesterPending }, addDays(NOW, -3))

    // 4f. assets (C2 + C3)
    if (ci === 1 || ci === 2) {
      const assetRows = [
        { id: uuid(), fund_circle_id: cfg.id, contribution_cycle_id: null, asset_type: "fixed_deposit", institution: "State Bank", amount: 20000, current_value: 21500, notes: "12-month FD", recorded_by: ownerId, recorded_at: toISODate(monthsAgo(3)) },
        { id: uuid(), fund_circle_id: cfg.id, contribution_cycle_id: null, asset_type: ci === 1 ? "mutual_fund" : "cash_in_hand", institution: ci === 1 ? "Index Fund" : "Treasurer", amount: 15000, current_value: ci === 1 ? 16200 : 15000, notes: null, recorded_by: ownerId, recorded_at: toISODate(monthsAgo(2)) },
      ]
      check("insert assets", (await db.from("cycle_asset_records").insert(assetRows)).error)
      audit(cfg.id, ownerId, "asset_recorded", "cycle_asset_record", assetRows[0].id as string, { amount: 20000 }, monthsAgo(3))
    }

    // 4g. draft settlement (C2 only)
    if (ci === 1) {
      const settlementId = uuid()
      // Per-member contribution totals from the contributions we just built
      const totalsByUser = new Map<string, number>()
      for (const row of contribRows) {
        const u = row.user_id as string
        totalsByUser.set(u, roundCurrency((totalsByUser.get(u) ?? 0) + (row.paid_amount as number)))
      }
      const totalBase = roundCurrency([...totalsByUser.values()].reduce((s, v) => s + v, 0))
      const totalValue = roundCurrency(totalBase * 1.08) // assume 8% growth from assets + interest
      check(
        "insert settlement",
        (
          await db.from("circle_settlements").insert({
            id: settlementId,
            fund_circle_id: cfg.id,
            total_value: totalValue,
            total_contributions_base: totalBase,
            status: "draft",
            calculated_by: ownerId,
            calculated_at: iso(addDays(NOW, -2)),
          })
        ).error
      )
      const payouts = [...totalsByUser.entries()]
        .filter(([, total]) => total > 0)
        .map(([userId, total]) => ({
          id: uuid(),
          circle_settlement_id: settlementId,
          user_id: userId,
          contribution_total: total,
          share_amount: totalBase > 0 ? roundCurrency((total / totalBase) * totalValue) : 0,
          disbursed: false,
        }))
      if (payouts.length) check("insert payouts", (await db.from("circle_settlement_payouts").insert(payouts)).error)
      audit(cfg.id, ownerId, "settlement_calculated", "circle_settlement", settlementId, { totalValue, totalBase }, addDays(NOW, -2))
    }

    console.log(`  members: ${members.length}, cycles: ${periods.length}, loans: ${batch.loans.length}`)
  }

  // 5. audit logs
  if (auditRows.length) check("insert audit_logs", (await db.from("audit_logs").insert(auditRows)).error)

  // 6. summary
  console.log("\n=== Seed complete ===")
  console.log("Circles + roles:")
  CIRCLES.forEach((c, ci) => {
    const roles = [`${ownerName}=${ownerRole(ci)}`, ...TESTERS.map((t) => `${t.name}=${t.roles[ci] ?? "member"}`)].join(", ")
    console.log(`  • ${c.name} — ${roles}`)
  })
  console.log("\nTester sign-in: each managed tester signs in to the app with their Google email below.")
  console.log("On first sign-in their managed history + role is re-keyed onto their real account.")
  TESTERS.forEach((t) => console.log(`  - ${t.name}: ${t.email}`))
}

main().catch((err) => {
  console.error("\nSeed failed:", err instanceof Error ? err.message : err)
  process.exit(1)
})
