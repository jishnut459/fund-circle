'use client'

import { useOptimistic, useState, useTransition } from 'react'
import { Search } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import ContributionTable, { PendingPayment } from './ContributionTable'

interface Contribution {
  id: string
  userId: string
  userName: string
  avatarUrl?: string | null
  expectedAmount: number
  paidAmount: number
  lateFee: number
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

type FilterKey = 'all' | 'unpaid' | 'partially_paid' | 'paid'

// Above this many members, the list needs search/filter tools to stay usable.
const TOOLBAR_THRESHOLD = 6

function deriveStatus(paidAmount: number, target: number): string {
  if (paidAmount === 0) return 'unpaid'
  if (paidAmount >= target) return paidAmount > target ? 'overpaid' : 'paid'
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
          return { ...c, paidAmount: newPaid, status: deriveStatus(newPaid, c.expectedAmount + c.lateFee) }
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
            status: deriveStatus(update.newPaidAmount, c.expectedAmount + c.lateFee),
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

const isFullyPaid = (status: string) => status === 'paid' || status === 'overpaid'

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
  const [filter, setFilter] = useState<FilterKey>('all')
  const [query, setQuery] = useState('')

  const handleOptimisticUpdate = (update: OptimisticUpdate) => {
    startTransition(() => updateOptimistic(update))
  }

  const all = optimisticState.contributions
  const counts = {
    all: all.length,
    unpaid: all.filter((c) => c.status === 'unpaid').length,
    partially_paid: all.filter((c) => c.status === 'partially_paid').length,
    paid: all.filter((c) => isFullyPaid(c.status)).length,
  }

  const q = query.trim().toLowerCase()
  const filtered = all.filter((c) => {
    const statusOk =
      filter === 'all' ? true : filter === 'paid' ? isFullyPaid(c.status) : c.status === filter
    const nameOk = q === '' || c.userName.toLowerCase().includes(q)
    return statusOk && nameOk
  })

  const showToolbar = all.length > TOOLBAR_THRESHOLD

  const filterDefs: { key: FilterKey; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'unpaid', label: 'Unpaid' },
    { key: 'partially_paid', label: 'Partial' },
    { key: 'paid', label: 'Paid' },
  ]

  return (
    <div>
      {showToolbar && (
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-4">
          <div className="flex flex-wrap gap-1.5">
            {filterDefs.map((f) => {
              const active = filter === f.key
              return (
                <button
                  key={f.key}
                  type="button"
                  onClick={() => setFilter(f.key)}
                  className={cn(
                    'inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium border transition-colors',
                    active
                      ? 'bg-teal text-white border-teal'
                      : 'bg-[var(--bg-surface)] text-[var(--text-secondary)] border-[var(--border-color)] hover:border-[var(--text-muted)]'
                  )}
                >
                  {f.label}
                  <span
                    className={cn(
                      'font-tabular tabular-nums rounded-full px-1.5 text-[10px]',
                      active ? 'bg-white/20' : 'bg-[var(--border-light)] text-[var(--text-muted)]'
                    )}
                  >
                    {counts[f.key]}
                  </span>
                </button>
              )
            })}
          </div>
          <div className="relative sm:ml-auto sm:w-56">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--text-muted)] pointer-events-none" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search members"
              className="pl-9 h-9"
              aria-label="Search members"
            />
          </div>
        </div>
      )}

      {all.length > 0 && filtered.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-sm text-[var(--text-muted)]">No members match this filter.</p>
          <button
            type="button"
            onClick={() => {
              setFilter('all')
              setQuery('')
            }}
            className="mt-2 text-xs font-medium text-teal hover:text-teal-dark transition-colors"
          >
            Clear filters
          </button>
        </div>
      ) : (
        <ContributionTable
          contributions={filtered}
          pendingPayments={optimisticState.pendingPayments}
          contributionCycleId={contributionCycleId}
          circleId={circleId}
          currentUserId={currentUserId}
          canEdit={canEdit}
          cycleClosed={cycleClosed}
          onOptimisticUpdate={handleOptimisticUpdate}
        />
      )}
    </div>
  )
}
