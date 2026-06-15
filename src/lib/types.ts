export type ActionResult<T = void> =
  | { success: true; data: T }
  | { success: false; error: string }

export type AssetType = "recurring_deposit" | "fixed_deposit" | "cash_in_hand" | "mutual_fund" | "other"

export type CycleAssetRecord = {
  id: string
  contributionCycleId: string | null
  assetType: AssetType
  institution: string | null
  amount: number
  currentValue: number | null
  notes: string | null
  recordedByName: string
  recordedAt: string
}

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
