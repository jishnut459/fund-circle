# Fund Circle — Product Documentation

## Overview

Fund Circle is a mobile-first SaaS app for managing community contribution groups (savings funds, wedding funds, welfare associations) in India. Organizations onboard members and track recurring contributions with full transparency and audit trails.

---

## Architecture

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router, Turbopack) |
| Language | TypeScript (strict mode) |
| Styling | Tailwind CSS v4 + custom design system |
| Backend/Database | Supabase (PostgreSQL, Auth, RLS) |
| Phone Auth | Firebase Phone Authentication (OTP) |
| Icons | Lucide |
| Hosting | Vercel |

### Project Structure

```
src/
  app/
    (auth)/login/            # Phone + OTP login
    (app)/
      layout.tsx             # Auth guard
      orgs/                  # Org selector + create
        [orgId]/
          layout.tsx          # Org context + sidebar/tabs
          dashboard/          # Owner + member dashboards
          fund-circles/       # List + create
            [circleId]/       # Detail + cycles
              cycles/[cycleId]/  # Contribution table
              members/        # Circle member management
          members/            # Org member directory
          audit-logs/         # Timeline audit log
          settings/           # Org settings, plan, admins
    api/auth/                 # Auth callbacks (verify, logout, rate-limit)
    api/dev/                  # Dev user switcher endpoint
  components/
    ui/                       # Design system primitives (Card, Badge, Button, etc.)
    layout/                   # AppShell, OrgSidebar, BottomTabBar, OrgContext
    dashboard/                # OwnerDashboard, MemberDashboard, MetricCard
    fund-circles/             # FundCircleCard, FundCircleForm
    contributions/            # ContributionTable, RecordPaymentDialog, StatusBadge
    members/                  # MemberTable, AddMemberDialog
    auth/                     # LoginCard, PhoneInputForm, OtpInputForm
    dev/                      # DevUserSwitcher
  lib/
    actions.ts                # All server actions (mutations)
    format.ts                 # Currency/date formatting utilities
    types.ts                  # ActionResult<T> type
    get-current-user.ts       # Session → user + role resolution
    permissions.ts            # Role check helpers (isOwner, isAdminOrOwner)
    audit.ts                  # writeAuditLog helper
    supabase-server.ts        # Server Supabase client (cookie-bound)
    supabase-client.ts        # Browser Supabase client
    dev-auth.ts               # Seeded dev users
    firebase-client.ts        # Firebase client SDK
    firebase-admin.ts         # Firebase Admin SDK
    rate-limit.ts             # OTP rate limiting
```

---

## Features

### 1. Authentication

**Two modes:**

| Mode | How It Works | Credentials |
|---|---|---|
| Dev (default) | `NEXT_PUBLIC_SKIP_AUTH=true` — skips login entirely. Auto-logs in as default dev user. | Dev badge (bottom-right) to switch between 3 seeded users |
| Production | Firebase Phone Auth — enter phone → receive OTP SMS → verify → Supabase session | Real phone numbers via Firebase |

**Seeded dev users:**

| Name | Phone | Role |
|---|---|---|
| Asha Owner | +919999900001 | owner |
| Vikram Admin | +919999900002 | admin |
| Ravi Member | +919999900003 | member |

### 2. Organizations

- Create organizations with name and optional description
- Each user can belong to multiple orgs with different roles
- Org selector page lists all orgs with role badges
- Single-org users skip the selector and go straight to dashboard

### 3. Role-Based Access Control

| Role | Permissions |
|---|---|
| **Owner** | Full access: create/edit fund circles, manage members, change roles, view audit logs, view settings |
| **Admin** | Same as owner (can manage everything) |
| **Member** | View dashboard, view fund circles, view own contributions. Cannot edit or manage. |

RBAC is enforced at two levels:
- **UI**: `lib/permissions.ts` helpers (`isOwner`, `isAdminOrOwner`) hide/show controls
- **Server**: Server actions re-check role before any mutation

### 4. Fund Circles

A fund circle represents a recurring contribution group with:
- **Name** and **description**
- **Contribution amount** (₹) per cycle
- **Contribution frequency** (monthly, every 15/30/45 days)
- **Status** (active, paused, closed)
- **Member count** — which org members participate

**Actions:**
- Create fund circles (plan-limited: free=1, pro=5, premium=unlimited)
- Start a new contribution cycle (creates contribution rows for all active members)
- Manage circle members (add/remove org members to the circle)

### 5. Contribution Cycles

Each cycle represents one collection period (e.g., "June 2026"):
- **Cycle period**: start and end dates
- **Status**: open or closed
- **Contributions**: one row per member showing expected vs paid amount

**Action:**
- Close a cycle (locks it, prevents further payments)

### 6. Contributions & Payments

Each contribution tracks:
- **Expected amount** (₹) — what the member should pay
- **Paid amount** (₹) — what has been paid so far
- **Status** — computed (not stored): unpaid, partially_paid, paid, overpaid
- **Payment date** and **notes**

**Recording a payment:**
- Quick-action checkmark button on each row
- Opens a dialog pre-filled with context (expected, paid so far, remaining)
- "Quick-fill remaining" button for one-tap full payment
- Confirmation message describes the specific outcome (e.g. "₹500 will remain")
- Audit log entry written automatically

### 7. Dashboard

**Owner/Admin view:**
- 4 metric cards: Fund Circles, Members, Total Collected, Pending
- Recent cycles list with progress bars and paid/partial/unpaid counts

**Member view:**
- 3 metric cards: Total Paid, Outstanding, Active Circles
- My Contributions list with per-cycle status and progress bars

### 8. Member Directory

- Table of all org members with name, phone, role badge
- Admins/owners can change member roles (member → admin → owner)
- Add new members via dialog (name + phone)
- Toggle circle membership per member (in circle detail page)

### 9. Audit Logs

Every financial and role-changing action is logged with:
- **Who** performed the action (user name)
- **What** action was taken (plain language: "Vikram recorded ₹1,000 payment")
- **When** (DD MMM YYYY at HH:MM format)
- **Entity type** badge

Audited actions:
- `org_created`, `member_added`, `member_role_changed`
- `fund_circle_created`
- `member_added_to_circle`, `member_removed_from_circle`
- `cycle_started`, `cycle_closed`
- `payment_recorded` (with previous/new paid amounts)

Displayed as a **timeline** with vertical line + dots instead of a plain table.

### 10. Settings

- Organization details (name, description — read-only)
- Subscription plan display with active circle count / limit
- Admins & Owners list with role badges

---

## Key Design Decisions

### Computed Status, Not Stored Status
Contribution status (unpaid/partial/paid/overpaid) is derived from `expected_amount` vs `paid_amount` via the `contributions_with_status` database view — never stored. This prevents data drift.

### Server Actions for All Mutations
All data mutations go through `lib/actions.ts` using Next.js server actions (`"use server"` directive). No client-side `fetch()` to custom API routes for mutations. Each action returns `ActionResult<T>`:

```typescript
type ActionResult<T = void> =
  | { success: true; data: T }
  | { success: false; error: string }
```

### Audit Logging Is Mandatory
Every financial or role-changing mutation calls `writeAuditLog()` with `previous_value` and `new_value` populated. No exceptions.

### Centralized Formatting
`lib/format.ts` provides:
- `formatCurrency(amount)` — ₹1,000 style with Indian comma grouping
- `formatDate(date)` — "14 Jun 2026" format
- `formatDateTime(date)` — "14 Jun 2026 at 10:30 PM"
- `formatISODate(iso)` — parses YYYY-MM-DD to "14 Jun 2026"
- `formatPercentage(paid, expected)` — returns integer percentage

### Currency Display
All amounts use `Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' })` with Indian lakh/crore comma grouping (₹1,00,000 not ₹100,000). Tabular figures (`font-variant-numeric: tabular-nums`) keep amounts aligned.

---

## Navigation

### Mobile (≤1024px)
Bottom tab bar with 4 items: Dashboard, Circles, Members, More (expands to Audit + Settings for admins)

### Desktop (≥1024px)
Collapsible left sidebar with org name, role badge, nav links, and user info at the bottom

### Page Structure
Every page follows: sticky header (title + action button) → metrics (if applicable) → main content → empty state (if no data)

---

## UI Design System

| Token | Value |
|---|---|
| Primary | Teal `#0F6E56` |
| Background | Warm cream `#FAF9F6` |
| Text | Charcoal `#2C2C2A` |
| Cards | `rounded-2xl` with subtle shadow |
| Status colors | Green (paid), Amber (partial), Gray (unpaid), Blue (overpaid) |
| Font | Inter (via next/font/google) |
| Dark mode | Supported via CSS variables + localStorage |

### Component Patterns
- **Empty states**: Icon + title + description + primary action button
- **Skeleton loaders**: Matching content shape, shimmer animation
- **Toast notifications**: Via Sonner (for action confirmations)
- **Status badges**: Color-coded dot + label for compact mobile display
- **Contribution rows**: Colored left-border (green/amber/gray/blue) + tap-to-expand on mobile
- **Record payment**: Checkmark icon button → pre-filled dialog → confirmation summary

---

## Dev Tools

- **DevUserSwitcher**: Fixed bottom-right corner, amber dashed-border badge. Opens dropdown to switch between 3 seeded users. Calls `/api/dev/switch-user` to set a cookie.
- **SKIP_AUTH flag**: Set in `.env.local` to bypass all Firebase auth and use seeded dev users directly.
