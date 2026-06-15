@AGENTS.md
# CLAUDE.md — Fund Circle Project Guide

This file gives Claude Code persistent context for working on Fund Circle. Read this before making changes. It covers project architecture, coding standards, and UI/UX design direction. Follow these consistently across sessions — don't reintroduce patterns this file explicitly avoids.

---

## 1. Product context

Fund Circle is a mobile-first SaaS app for managing community contribution groups (savings funds, wedding funds, welfare associations) in India. A **fund circle** is the top-level tenant unit — each has its own subscription plan, member cap, and billing; there is no separate organization layer above it. Members and admins track recurring contributions with full transparency and audit trails. Users are mostly non-technical — community admins and members checking payment status on their phones. The core value is **trust through transparency**: every rupee collected should feel accounted for and visible.

---

## 2. Tech stack

- **Framework**: Next.js (App Router), TypeScript (strict mode)
- **Styling**: Tailwind CSS + shadcn/ui
- **Backend**: Supabase (PostgreSQL, Auth, Row Level Security, Edge Functions)
- **Hosting**: Vercel
- **Icons**: Lucide (ships with shadcn) — no mixed icon sets

---

## 3. Architecture & project structure

```
src/
  app/
    (auth)/
      login/                -- Google OAuth sign-in (LoginCard)
    auth/callback/          -- OAuth callback route -- exchanges code, calls resolveUserOnSignIn
    (app)/
      layout.tsx             -- auth guard (redirects to /login if no session)
      (circles-home)/
        circles/              -- circle list -- selector + "New Circle" dialog
      circles/
        [circleId]/
          layout.tsx           -- membership + role check, circle header, role-based nav
          dashboard/
          cycles/              -- cycle list + [cycleId] detail (contributions table)
          members/
          audit-logs/
          settings/
    api/
      auth/logout/           -- route handlers: auth callbacks only

components/
  ui/                      -- shadcn primitives (do not hand-edit -- regenerate via shadcn CLI)
  layout/                  -- AppShell (sidebar + bottom tab bar), UserDropdown
  auth/                    -- LoginCard
  dashboard/               -- OwnerDashboard, MemberDashboard
  fund-circles/            -- FundCircleCard, FundCircleForm
  contributions/           -- ContributionTable, ContributionStatusBadge, RecordPaymentDialog
  members/                 -- MemberTable, AddMemberDialog
  audit/

lib/
  supabase-server.ts       -- cookie-bound server client + admin (service-role) client
  supabase-client.ts       -- browser client, signInWithGoogle
  get-current-user.ts       -- resolves session → user profile + per-circle role
  permissions.ts            -- role-check helpers (isOwner, isAdminOrOwner, canEditContributions, canEditCircle)
  audit.ts                  -- writeAuditLog helper
  onboarding.ts             -- resolveUserOnSignIn -- profile upsert + pending invite acceptance
  format.ts                 -- currency/date/percentage formatting helpers
  types.ts                  -- ActionResult<T>
  actions.ts                -- Server Actions (createFundCircle, recordPayment, addCircleMember, etc.)

supabase/
  migrations/
  seed.sql
```

### Architectural rules

- **Server-first data fetching**: fetch data in server components / server actions wherever possible. Client components only for interactivity (forms, dialogs, optimistic updates).
- **Server actions for mutations**: all writes (create fund circle, record payment, add member, etc.) go through server actions in `lib/actions.ts`, not client-side `fetch` to API routes. Reserve `app/api/` for webhooks and auth callbacks only.
- **RLS is the source of truth for access control**: every table has RLS policies. `lib/permissions.ts` helpers gate UI rendering (hide buttons), but server actions must never assume the UI gate was respected -- they re-check role server-side before mutating.
- **Circle context via route segment**: `[circleId]` in the URL is the single source of truth for "which circle am I in." Don't store the active circle in client state/localStorage -- `circles/[circleId]/layout.tsx` re-verifies membership and role server-side on every request.
- **Audit logging is mandatory for financial mutations**: any insert/update to `contributions`, `contribution_payments`, `contribution_cycles`, `fund_circles`, or `fund_circle_members` must call `writeAuditLog()` in the same server action, with `previous_value`/`new_value` populated.
- **Computed status, not stored status**: contribution status (unpaid/partial/paid/overpaid) is derived from `expected_amount` vs `paid_amount` -- via the `contributions_with_status` view or equivalent computed field. Never add a stored `status` column that can drift from the underlying amounts.

---

## 4. Coding style

### TypeScript
- Strict mode on. No `any` -- use `unknown` and narrow, or define proper types/interfaces.
- Prefer `type` for data shapes, `interface` for component props.
- Co-locate types with the feature that owns them (e.g. `components/contributions/types.ts`), not one giant global types file.

### Components
- Functional components only. No class components.
- Server components by default -- add `'use client'` only when the component needs state, effects, or browser APIs.
- Keep components focused: a component that fetches data, transforms it, AND renders a complex UI should usually be split into a server component (fetch) wrapping a presentational component (render).
- Props should be explicit and typed -- no `...rest` spreading that obscures what a component accepts, unless wrapping a shadcn primitive.

### Naming
- Files: `kebab-case.tsx` for files, `PascalCase` for component names, `camelCase` for functions/variables.
- Server actions: verb-first names (`createFundCircle`, `recordPayment`, `closeContributionCycle`).
- Booleans: `isX`, `hasX`, `canX` (matches `lib/permissions.ts` convention).

### Error handling
- Server actions return a discriminated result type, not thrown errors for expected failures:
  ```typescript
  type ActionResult<T> = { success: true; data: T } | { success: false; error: string };
  ```
- Reserve thrown errors for truly unexpected failures (Supabase connection issues, etc.) -- let Next.js error boundaries handle those.
- User-facing error messages are plain language, never raw Postgres/Supabase error strings.

### Comments
- Comment *why*, not *what*. Avoid restating the code in prose.
- Flag any temporary/dev-only code with `// TODO(dev-bypass):` so it's greppable before going to production.

### Formatting
- Prettier defaults, 2-space indent, single quotes. Follow whatever `.prettierrc` is committed -- don't reformat unrelated files in the same change.
- Run lint/typecheck before considering a task complete.

---

## 5. Visual identity

### Palette
Move away from default shadcn slate/zinc.

- **Primary accent**: deep teal/emerald (`#0F6E56` to `#1D9E75` range) -- trust, money, growth. Use for primary buttons, active nav states, positive status badges.
- **Neutral base**: warm off-white/cream background (`#FAF9F6` range) instead of pure white or gray, with charcoal text (`#2C2C2A` range). Approachable, not clinical.
- **Status colors** (consistent everywhere -- badges, dashboard metrics, charts):
  - Paid = green
  - Partial = amber
  - Unpaid = gray
  - Overpaid = blue
- **One secondary accent maximum** -- a warm coral, used sparingly for alerts/CTAs needing attention. No third accent color.

### Typography
- Clean geometric sans for headings (Inter, DM Sans, or Geist) with a distinct weight/size scale from shadcn defaults -- headings should feel confident, not generic.
- Currency amounts and totals get visual weight: `font-variant-numeric: tabular-nums`, larger size, bolder weight. Money is the most important data in this app -- it should look like it.

### Cards & surfaces
- Subtle elevation: soft shadows (not harsh), `rounded-xl` or `rounded-2xl`, generous internal padding.
- Avoid heavy borders everywhere. Separate sections with whitespace and background contrast (card vs page background), not boxes.

### Iconography
- Use Lucide consistently -- every nav item, status badge, and empty state gets a matching icon. No mixed icon styles.

---

## 6. Layout & navigation

- **Mobile**: bottom tab bar for primary nav (Dashboard, Members, Audit Logs, Settings) -- not a hamburger menu. 4-5 thumb-reachable items max.
- **Desktop/tablet**: collapsible left sidebar with the same nav items, circle name + "All Circles" link at the top to return to the circle list/switcher.
- Sticky page headers: title + primary action button (e.g. "+ New Fund Circle") always visible without scrolling.
- Consistent page structure: header → key metrics (if applicable) → main content list/table → empty states.

---

## 7. Key UX patterns

1. **Money is the hero** -- on every screen showing amounts (dashboard, contribution tables, member summaries), ₹ amounts should be the largest, boldest visual element. Labels and metadata recede.

2. **Status at a glance** -- contribution status (unpaid/partial/paid/overpaid) scannable without reading: color-coded badges, or colored left-borders on table rows. On mobile, use a colored dot + label rather than a full badge if space is tight.

3. **Progressive disclosure for tables** -- contribution tables can have 100+ rows. On mobile, collapse each row to name + amount + status badge; tapping expands to show payment date, notes, and the "record payment" action.

4. **One-tap actions for the highest-frequency task** -- recording a payment is the most common admin action. Provide a quick-action button per row (e.g. a checkmark that opens a pre-filled "mark as paid" dialog with the expected amount already entered). Don't force a full form every time.

5. **Empty states that guide, not just inform** -- every empty list (no fund circles, no members, no cycles, no audit logs) includes: an icon, one sentence explaining the screen's purpose, and a clear primary action button. Treat empty states as onboarding moments.

6. **Confirmation for destructive/financial actions** -- editing a payment amount, closing a cycle, removing a member: show a confirmation dialog that summarizes the specific change (e.g. "Change Ravi's payment from ₹500 to ₹1000?"), not a generic "Are you sure?".

7. **Role-aware UI, not role-aware screens** -- members and admins see the same layouts with controls hidden/shown based on role, not separate designs. Keeps the product cohesive and reinforces transparency.

8. **Loading and feedback**
   - Skeleton loaders (matching content shape) instead of spinners for page loads.
   - Toast notifications for action confirmations ("Payment recorded", "Member added") -- non-blocking, auto-dismiss.
   - Optimistic UI updates for quick actions where feasible.

9. **Number and date formatting** -- implement once in `lib/format.ts` and reuse everywhere:
   - Currency: `₹1,000`, Indian comma grouping for larger numbers (`₹1,00,000` not `₹100,000`) -- use `Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' })`.
   - Dates: `DD MMM YYYY` (e.g. "14 Jun 2026"), not US format.

10. **Dark mode** -- support via existing Tailwind/shadcn CSS variable approach. Status colors (green/amber/gray/blue) must remain distinguishable in dark mode.

---

## 8. Component-specific direction

- **Dashboard metric cards**: large number, small label above/below, optional trend indicator ("+₹5,000 vs last cycle"). Responsive grid: 2 columns mobile, 4 desktop.
- **Fund Circle cards**: name, status badge, contribution amount + frequency prominently shown, plus a progress indicator for the current cycle's collection (e.g. "₹8,000 / ₹10,000 collected -- 80%").
- **Contribution table**: sticky header row, alternating row backgrounds, status badge column always visible (never scrolls off on mobile).
- **Audit log**: timeline-style layout (vertical line + dots), not a plain table. Each entry: actor, plain-language action ("Vikram recorded ₹1,000 payment for Ravi"), timestamp.
- **Circle list (`/circles`)**: acts as the circle switcher -- card grid of circles the user belongs to, each showing name + role badge, plus "New Circle" entry point.

---

## 9. Hard constraints -- do not do

- No third accent color beyond teal + one warm highlight.
- No gradients, glassmorphism, or heavy shadows -- flat and clean with subtle depth only.
- No horizontally scrollable tables on mobile if avoidable -- prefer collapsing/stacking content.
- No client-side `fetch` to custom API routes for mutations -- use server actions.
- No stored/derivable state that can drift (e.g. a `status` column duplicating `expected_amount`/`paid_amount`).
- No skipping `writeAuditLog()` for financial mutations.
- No `any` types.
- During a pure styling pass: no changes to data fetching, routes, component props, or business logic.

---

## 10. Workflow checklist

Before considering any task complete:

1. Lint and typecheck pass.
2. RLS policies updated if a new table/column was added, and verified against the relevant role (owner/admin/member).
3. Audit log entries added for any new financial mutation.
4. Currency and date formatting goes through `lib/format.ts`.
5. Dark mode and mobile (360px) verified for any page touched.
6. Empty states present for any new list view.
7. Server actions return `ActionResult<T>`, not thrown errors, for expected failure cases.