# Fund Circle — Persona Guide

Fund Circle is a mobile-first, multi-tenant SaaS app for managing community contribution groups (savings funds, wedding funds, welfare associations) in India. Organizations onboard members and track recurring contributions with full transparency and audit trails.

All users authenticate via Google OAuth. The app enforces three distinct roles: **Owner**, **Admin**, and **Member**.

---

## Role Comparison

| Capability | Owner | Admin | Member |
|---|---|---|---|
| View dashboard with org metrics | Yes | Yes | Yes (personal view) |
| View fund circles & cycles | Yes | Yes | Yes |
| View member directory | Yes | Yes | Yes |
| Create / edit / delete fund circles | Yes | Yes | No |
| Start a new contribution cycle | Yes | Yes | No |
| Close a contribution cycle | Yes | Yes | No |
| Record member payments | Yes | Yes | No |
| Add members to the organization | Yes | Yes | No |
| Toggle members in/out of fund circles | Yes | Yes | No |
| Change member roles (promote/demote) | **Yes** | No | No |
| View audit log | Yes | Yes | No |
| View organization settings | Yes | Yes | No |
| View & revoke pending invites | Yes | Yes | No |
| Update/delete the organization | **Yes** | No | No |

**Key distinction**: Admin has the same day-to-day operational powers as Owner (manage circles, cycles, members, payments). Only the Owner can change roles, update org details, or delete the org.

---

## Owner Persona

The Owner is typically the person who founded the organization. They have full control.

### 1. Creating an Organization

1. Sign in with Google (`/login`).
2. On the org selector page (`/orgs`), click **"Create Organization"**.
3. Enter the org name and description.
4. The creator is automatically assigned the **Owner** role.

### 2. Managing the Organization

Navigate to **Settings** (`/orgs/[orgId]/settings`):
- View organization name and description.
- See the current subscription plan (Free: 1 circle, Pro: 5, Premium: unlimited) and usage count.
- View and revoke pending member invites.
- See a list of all Admins and Owners in the org.

### 3. Managing Members

Navigate to the **Members** page (`/orgs/[orgId]/members`):
- **Add members** via the "Add Member" dialog — enter email, name, and role (Owner/Admin/Member).
  - If the email matches an existing profile, the user is added immediately.
  - If not, a pending invite is created; the user will be automatically added when they sign up.
- **Change roles** via the role dropdown on each member row. Select from Owner, Admin, or Member.
  - Cannot demote the last remaining Owner (prevents locking out the org).
- **Toggle circle membership** for each member from the members table.

### 4. Managing Fund Circles

Navigate to **Fund Circles** (`/orgs/[orgId]/fund-circles`):
- **Create** a new fund circle with name, description, contribution amount (INR), and frequency (monthly, every 15/30/45 days).
- View all circles with progress indicators showing current cycle collection status.
- **Start a new cycle** for any active circle — creates contribution records for all active members with the expected amount.
- **Close a cycle** when the collection period ends — prevents further payments.

### 5. Recording Payments

From a cycle detail page (`/orgs/[orgId]/fund-circles/[circleId]/cycles/[cycleId]`):
- View the contribution table showing each member's expected amount, paid amount, and status (Unpaid/Partial/Paid/Overpaid).
- Click the checkmark button on any row to open the **Record Payment** dialog.
- Enter the payment amount and optional notes. The dialog shows:
  - Expected amount, paid so far, and remaining.
  - A "Quick-fill remaining" button for one-tap full payment.
  - A confirmation message describing the outcome.
- Payment is recorded with an audit log entry tracking who recorded it and any changes.

### 6. Dashboard (Owner View)

The Owner dashboard (`/orgs/[orgId]/dashboard`) shows org-wide metrics:
- **Fund Circles** — count of active circles.
- **Members** — total org member count.
- **Collected** — total INR collected across all cycles, with "% of X this cycle".
- **Pending** — count of unpaid/partial contributions.
- **Recent Cycles** — last 5 cycles with progress bars, paid/partial/unpaid counts, and collection progress.

### 7. Audit Log

Navigate to **Audit Logs** (`/orgs/[orgId]/audit-logs`):
- Timeline view showing every action taken in the org.
- Each entry shows: who did what (e.g., "Vikram recorded ₹1,000 payment (was ₹500)"), when (DD MMM YYYY at HH:MM), and the entity type.
- Covers: org creation, member additions/role changes, invites sent/revoked/accepted, fund circle creation, cycle start/close, payments recorded.

---

## Admin Persona

The Admin is a trusted member who handles day-to-day operations but cannot change the org structure or member roles.

### 1. Joining an Organization

1. An Owner or existing Admin adds them via the Members page (by email).
2. If they already have a profile, they are added immediately and can access the org from their org selector.
3. If new, they receive an invite; upon signing in with Google, they are automatically added.

### 2. Managing Fund Circles

- **Create** fund circles with name, amount, and frequency.
- View all circles and their collection progress.
- **Start new cycles** when a collection period begins.
- **Close cycles** when collection is complete.

### 3. Recording Payments

- Open any cycle and use the Record Payment dialog on member rows.
- Same workflow as Owner: enter amount, use quick-fill, confirm.
- Every payment is audit-logged.

### 4. Adding Members

- From the Members page, invite or add members with any role (Owner/Admin/Member).
- Toggle members in/out of fund circles.
- **Cannot change anyone's role** — this is Owner-only.

### 5. Dashboard (Admin View)

Same as Owner: sees org-wide metrics including total collected, pending contributions, and recent cycles across all members.

### 6. Settings & Audit Logs

- Access the Settings page to see org details, plan, pending invites, and admin/owner list.
- View the full audit log timeline.
- Cannot update org details or revoke members.

---

## Member Persona

The Member is a contributor within one or more fund circles. Their experience focuses on personal contribution tracking.

### 1. Joining an Organization

1. Added by an Owner or Admin via the Members page.
2. Can be assigned to specific fund circles at the time of invitation or later.

### 2. Dashboard (Member View)

The Member dashboard (`/orgs/[orgId]/dashboard`) shows personal metrics:
- **Total Paid** — sum of all contributions made across cycles.
- **Outstanding** — total expected minus total paid.
- **Active Circles** — number of circles they participate in.
- **My Contributions** — per-circle, per-cycle list showing:
  - Circle name and cycle label.
  - Expected amount and paid amount.
  - Status badge (Paid = green, Partial = amber, Unpaid = gray).
  - Progress bar.

### 3. Viewing Fund Circles & Cycles

- Navigate to Fund Circles to see all circles in the org.
- Tap into any circle to view its cycles.
- Tap into a cycle to see the full contribution table — **all members' payment statuses are visible** (transparency is a core design principle).
- Cannot start/close cycles or record payments.

### 4. Member Directory

- Navigate to Members to see everyone in the org, their roles, and which circles they belong to.
- Cannot add, remove, or change roles.

### 5. What Members Cannot Access

- **Fund Circle creation** — no "New Circle" button visible.
- **Cycle management** — no start/close cycle controls.
- **Payment recording** — no checkmark/record payment buttons.
- **Audit Logs** — not visible in navigation; page redirects to dashboard.
- **Settings** — not visible in navigation; page redirects to dashboard.
- **Role management** — no role dropdown in the member table.

---

## Navigation

### Mobile
A bottom tab bar with 4 items:
1. **Dashboard** — overview metrics.
2. **Fund Circles** — list of all circles.
3. **Members** — org member directory.
4. **More** (Owner/Admin only) — Audit Logs + Settings.

### Desktop
A collapsible left sidebar with the same navigation items, plus an org name and switcher at the top.

---

## Key Design Principles

1. **Transparency**: All members can see everyone's payment statuses. No hidden data.
2. **Computed status, not stored status**: Contribution status (Unpaid/Partial/Paid/Overpaid) is always derived from `paid_amount` vs `expected_amount` — never a manually-set column that can drift.
3. **Row Level Security (RLS)**: Every database table has RLS policies that enforce role-based access at the database level. UI helpers like `isAdminOrOwner()` only hide buttons — the database is the real gate.
4. **Audit trail**: Every meaningful action (payment, cycle start/close, member add/remove, role change) is logged immutably with actor, action, previous/new values, and timestamp.
5. **Financial integrity**: Payments add to a running `paid_amount` total rather than overwriting; individual payment records are preserved separately.
