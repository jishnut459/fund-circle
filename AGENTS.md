<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Fund Circle — Agent Reference

## Commands
```bash
npm run dev      # Start dev server (Turbopack)
npm run build    # Production build
npm run lint     # ESLint (Next.js core-web-vitals + TypeScript)
# No explicit typecheck script — run: npx tsc --noEmit
```

## Environment
Copy `.env.local.example` → `.env.local` and fill:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (server-only)

## Architecture Rules (Non-Negotiable)

| Rule | Detail |
|------|--------|
| **Server-first** | Fetch in Server Components / Server Actions. Client components only for interactivity. |
| **Server Actions for mutations** | All writes in colocated `actions.ts`. `app/api/` = webhooks & auth callbacks ONLY. |
| **RLS is the source of truth** | Every table has RLS. `lib/permissions.ts` gates UI; server actions **must** re-check roles. |
| **Org context via route** | `[orgId]` (here `[circleId]`) in URL = single source of truth. Never store in client state. |
| **Audit logging mandatory** | All financial mutations (contributions, payments, fund_circles, members, organizations) call `writeAuditLog()` with `previous_value`/`new_value`. |
| **Computed status** | Contribution status derived from `expected_amount` vs `paid_amount` via `contributions_with_status` view. No stored `status` column. |

## Project Structure
```
src/
  app/
    (auth)/           # login, OTP callback
    (app)/
      layout.tsx      # auth guard + current-user/circle context
      circles/
        [circleId]/
          layout.tsx   # active circle context, role-based nav
          dashboard/
          cycles/[cycleId]/
          members/
          audit-logs/
          settings/
    api/              # auth callbacks, webhooks ONLY
  components/
    ui/               # shadcn primitives — DO NOT HAND-EDIT (regenerate via shadcn CLI)
    layout/           # AppShell, sidebar, bottom tabs, circle switcher
    dashboard/ | fund-circles/ | contributions/ | members/ | audit/ | dev/
  lib/
    supabase-server.ts    # cookie-bound server client
    supabase-client.ts    # browser client
    get-current-user.ts   # session → user + circle role
    permissions.ts        # isOwner, isAdminOrOwner, canEditContributions
    audit.ts              # writeAuditLog()
    format.ts             # INR currency (en-IN), DD MMM YYYY dates
    actions.ts            # Server Actions (verb-first: createFundCircle, recordPayment…)
    types.ts              # ActionResult<T> = {success:true,data:T}|{success:false,error:string}
```

## Coding Conventions

- **TypeScript strict** — no `any`, use `unknown` + narrowing or proper types
- **Server components by default** — add `'use client'` only for state/effects/browser APIs
- **Component props explicit** — no `...rest` spreading (except wrapping shadcn primitives)
- **Server Actions return `ActionResult<T>`** — discriminated union, not thrown errors for expected failures
- **Currency** — `formatCurrency()` in `lib/format.ts` uses `Intl.NumberFormat('en-IN', {style:'currency',currency:'INR'})`
- **Dates** — `formatDate()` = `DD MMM YYYY` (e.g., "14 Jun 2026")

## Workflow Checklist (Before Task Complete)
1. `npm run lint` passes
2. `npx tsc --noEmit` passes
3. RLS policies updated/verified for any new table/column
4. `writeAuditLog()` called for all financial mutations
5. Currency/date formatting via `lib/format.ts`
6. Dark mode + mobile (360px) verified for touched pages
7. Empty states present for new list views

## Hard Constraints
- No third accent color beyond teal + one warm highlight
- No gradients, glassmorphism, heavy shadows
- No horizontally scrollable tables on mobile (prefer collapse/stack)
- No client-side `fetch` to API routes for mutations — use Server Actions
- No stored derivable state that can drift
- No skipping `writeAuditLog()` for financial mutations
- No `any` types
- During pure styling: no data fetching, route, prop, or logic changes

## Supabase Notes
- Migrations in `supabase/migrations/` (apply via `supabase db push`)
- Consolidated seed in `supabase/seed.sql` (drops + recreates all)
- `contributions_with_status` view = source of truth for payment status
- All tables have RLS; policies named like `fc_select_member`, `contrib_update_admin_or_owner`