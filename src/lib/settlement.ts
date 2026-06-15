import { roundCurrency } from "./loans"

/**
 * Proportional share for one member in a circle settlement.
 * share = (memberContributionTotal / totalContributionsBase) × totalValue
 * Returns 0 if no contributions have been collected (avoids divide-by-zero).
 */
export function computeMemberShare(
  memberContributionTotal: number,
  totalContributionsBase: number,
  totalValue: number
): number {
  if (totalContributionsBase <= 0) return 0
  return roundCurrency((memberContributionTotal / totalContributionsBase) * totalValue)
}
