export type ActionResult<T = void> =
  | { success: true; data: T }
  | { success: false; error: string }

/** Per-circle loan/asset allocation, eligibility, and late-fee configuration (fund_circles columns from migration 0001). */
export type LoanSettings = {
  assetAllocationPct: number
  loanAllocationPct: number
  loanInterestRatePct: number
  maxLoanPctOfContribution: number
  maxLoanPctOfLendingPool: number
  contributionLateFee: number
  contributionGraceDays: number
  loanLateFee: number
  loanGraceDays: number
}
