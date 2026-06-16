import { toISODate } from "./cycles"

export type AmortizationRow = {
  installmentNumber: number
  dueDate: string
  principalComponent: number
  interestComponent: number
  totalDue: number
}

export function roundCurrency(value: number): number {
  return Math.round(value * 100) / 100
}

/**
 * Reducing-balance (amortized) EMI for a loan.
 * EMI = P * r * (1+r)^n / ((1+r)^n - 1), where r is the monthly rate
 * (annualRatePct / 1200). Falls back to an equal principal split when the
 * rate is 0.
 */
export function calculateEMI(principal: number, annualRatePct: number, termMonths: number): number {
  if (termMonths <= 0) return 0
  const monthlyRate = annualRatePct / 1200
  if (monthlyRate === 0) return roundCurrency(principal / termMonths)
  const factor = Math.pow(1 + monthlyRate, termMonths)
  return roundCurrency((principal * monthlyRate * factor) / (factor - 1))
}

/**
 * Generates a monthly amortization schedule starting one month after
 * issueDate. The final installment absorbs any rounding remainder so the
 * principal components sum exactly to the loan principal.
 */
export function generateAmortizationSchedule(
  principal: number,
  annualRatePct: number,
  termMonths: number,
  issueDate: Date
): AmortizationRow[] {
  const emi = calculateEMI(principal, annualRatePct, termMonths)
  const monthlyRate = annualRatePct / 1200
  const rows: AmortizationRow[] = []
  let remainingPrincipal = principal

  for (let installmentNumber = 1; installmentNumber <= termMonths; installmentNumber++) {
    const dueDate = new Date(issueDate.getFullYear(), issueDate.getMonth() + installmentNumber, issueDate.getDate())
    const interestComponent = roundCurrency(remainingPrincipal * monthlyRate)
    let principalComponent = roundCurrency(emi - interestComponent)

    if (installmentNumber === termMonths) {
      principalComponent = roundCurrency(remainingPrincipal)
    }

    const totalDue = roundCurrency(principalComponent + interestComponent)
    remainingPrincipal = roundCurrency(remainingPrincipal - principalComponent)

    rows.push({
      installmentNumber,
      dueDate: toISODate(dueDate),
      principalComponent,
      interestComponent,
      totalDue,
    })
  }

  return rows
}

/** Date of the final installment — used to validate against circle.end_date at loan issuance. */
export function finalInstallmentDate(issueDate: Date, termMonths: number): Date {
  return new Date(issueDate.getFullYear(), issueDate.getMonth() + termMonths, issueDate.getDate())
}

/** Whole months remaining between today and an end date — used to cap loan terms so the final installment doesn't fall after it. */
export function monthsUntil(endDateIso: string): number {
  const end = new Date(endDateIso)
  const now = new Date()
  let months = (end.getFullYear() - now.getFullYear()) * 12 + (end.getMonth() - now.getMonth())
  if (end.getDate() < now.getDate()) months -= 1
  return Math.max(0, months)
}

/** Funds available to lend: the lending-pool share of all contributions collected, minus principal already on loan. */
export function computeLendingPoolAvailable(params: {
  totalContributionsCollected: number
  loanAllocationPct: number
  totalPrincipalOutstanding: number
}): number {
  const allocated = params.totalContributionsCollected * (params.loanAllocationPct / 100)
  return roundCurrency(allocated - params.totalPrincipalOutstanding)
}

/**
 * Loan eligibility: capped at the lower of a member's contribution-based cap
 * and a share of the available lending pool, minus what they already owe.
 */
export function computeEligibility(params: {
  totalContributionsPaid: number
  maxLoanPctOfContribution: number
  lendingPoolAvailable: number
  maxLoanPctOfLendingPool: number
  outstandingPrincipal: number
}): { maxByContribution: number; maxByPool: number; eligibleAmount: number } {
  const maxByContribution = roundCurrency(params.totalContributionsPaid * (params.maxLoanPctOfContribution / 100))
  const maxByPool = roundCurrency(params.lendingPoolAvailable * (params.maxLoanPctOfLendingPool / 100))
  const eligibleAmount = Math.max(0, roundCurrency(Math.min(maxByContribution, maxByPool) - params.outstandingPrincipal))
  return { maxByContribution, maxByPool, eligibleAmount }
}

/** The asset-allocation share of all contributions collected so far. */
export function computeAssetsValue(totalContributionsCollected: number, assetAllocationPct: number): number {
  return roundCurrency(totalContributionsCollected * (assetAllocationPct / 100))
}

/**
 * Sum of principal_component across installments that are not fully paid.
 * Used to determine the outstanding balance for prepayment and foreclosure.
 */
export function calculateOutstandingPrincipal(
  installments: { principalComponent: number; paidAmount: number; totalDue: number }[]
): number {
  return roundCurrency(
    installments
      .filter((i) => i.paidAmount < i.totalDue)
      .reduce((sum, i) => sum + i.principalComponent, 0)
  )
}

/**
 * Number of full months needed to pay off a principal at the given EMI.
 * Returns the count of full-EMI installments; the final installment will
 * be smaller (just the remaining balance + interest on it).
 * Used by the reduce_tenure prepayment strategy.
 */
export function monthsToPayOff(principal: number, monthlyRate: number, emi: number): number {
  if (principal <= 0) return 0
  if (monthlyRate === 0) return Math.ceil(principal / emi)
  // Solve n = -log(1 - r*P/EMI) / log(1+r)
  const ratio = (monthlyRate * principal) / emi
  if (ratio >= 1) return 999 // EMI too small to cover interest — shouldn't happen
  return Math.ceil(-Math.log(1 - ratio) / Math.log(1 + monthlyRate))
}

/**
 * Accrued interest to today on the outstanding principal.
 * Covers principal components of overdue/current unpaid installments only —
 * future interest is NOT charged on early settlement.
 */
export function calculateAccruedInterest(
  installments: { interestComponent: number; dueDate: string; paidAmount: number; totalDue: number }[],
  todayIso: string
): number {
  return roundCurrency(
    installments
      .filter((i) => i.paidAmount < i.totalDue && i.dueDate <= todayIso)
      .reduce((sum, i) => sum + i.interestComponent, 0)
  )
}
