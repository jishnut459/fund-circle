'use client'

import { useOptimistic, useTransition } from 'react'
import ContributionTable, { PendingPayment } from './ContributionTable'

interface Contribution {
  id: string
  userId: string
  userName: string
  avatarUrl?: string | null
  expectedAmount: number
  paidAmount: number
  paymentDate: string | null
  notes: string | null
  status: string
}

type State = {
  contributions: Contribution[]
  pendingPayments: Record<string, PendingPayment>
}

type OptimisticUpdate =
  | { type: 'verify'; contributionId: string; addedAmount: number }
  | { type: 'reject'; contributionId: string }
  | { type: 'edit'; contributionId: string; newPaidAmount: number }
  | { type: 'addPending'; contributionId: string; paymentId: string; amount: number; submittedByName?: string }

function deriveStatus(paidAmount: number, expectedAmount: number): string {
  if (paidAmount === 0) return 'unpaid'
  if (paidAmount >= expectedAmount) return paidAmount > expectedAmount ? 'overpaid' : 'paid'
  return 'partially_paid'
}

function reducer(state: State, update: OptimisticUpdate): State {
  switch (update.type) {
    case 'verify': {
      const newPending = { ...state.pendingPayments }
      delete newPending[update.contributionId]
      return {
        contributions: state.contributions.map((c) => {
          if (c.id !== update.contributionId) return c
          const newPaid = c.paidAmount + update.addedAmount
          return { ...c, paidAmount: newPaid, status: deriveStatus(newPaid, c.expectedAmount) }
        }),
        pendingPayments: newPending,
      }
    }
    case 'reject': {
      const newPending = { ...state.pendingPayments }
      delete newPending[update.contributionId]
      return { ...state, pendingPayments: newPending }
    }
    case 'edit': {
      return {
        ...state,
        contributions: state.contributions.map((c) => {
          if (c.id !== update.contributionId) return c
          return {
            ...c,
            paidAmount: update.newPaidAmount,
            status: deriveStatus(update.newPaidAmount, c.expectedAmount),
          }
        }),
      }
    }
    case 'addPending': {
      return {
        ...state,
        pendingPayments: {
          ...state.pendingPayments,
          [update.contributionId]: {
            id: update.paymentId,
            amount: update.amount,
            submittedByName: update.submittedByName,
          },
        },
      }
    }
  }
}

export default function ContributionTableClient({
  initialContributions,
  initialPendingPayments,
  contributionCycleId,
  circleId,
  currentUserId,
  canEdit,
  cycleClosed,
}: {
  initialContributions: Contribution[]
  initialPendingPayments: Record<string, PendingPayment>
  contributionCycleId?: string
  circleId: string
  currentUserId: string
  canEdit: boolean
  cycleClosed: boolean
}) {
  const [optimisticState, updateOptimistic] = useOptimistic(
    { contributions: initialContributions, pendingPayments: initialPendingPayments },
    reducer
  )
  const [, startTransition] = useTransition()

  const handleOptimisticUpdate = (update: OptimisticUpdate) => {
    startTransition(() => updateOptimistic(update))
  }

  return (
    <ContributionTable
      contributions={optimisticState.contributions}
      pendingPayments={optimisticState.pendingPayments}
      contributionCycleId={contributionCycleId}
      circleId={circleId}
      currentUserId={currentUserId}
      canEdit={canEdit}
      cycleClosed={cycleClosed}
      onOptimisticUpdate={handleOptimisticUpdate}
    />
  )
}
