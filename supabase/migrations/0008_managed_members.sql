-- ============================================================
-- 0008: Managed (offline / non-app) members
-- ============================================================
-- Lets admins add members who have no app login. A managed member
-- is a `profiles` row with NO matching `auth.users` row. To make
-- that possible, `profiles` is decoupled from `auth.users` and
-- becomes the single canonical "member id" used everywhere
-- `user_id` already points today.
--
-- For real app users nothing changes: profiles.id still equals
-- auth.users.id (set explicitly on sign-in), so every auth.uid()
-- comparison and existing insert keeps working verbatim.
--
-- Identity/subject columns repoint auth.users -> profiles.
-- Actor columns (recorded_by, verified_by, reviewed_by, etc.) stay
-- on auth.users because they are always a real, logged-in admin.

-- ------------------------------------------------------------
-- 1. Decouple profiles from auth.users + add managed fields
-- ------------------------------------------------------------
alter table profiles drop constraint profiles_id_fkey;
alter table profiles alter column id set default gen_random_uuid();

alter table profiles
  add column if not exists is_managed boolean not null default false,
  add column if not exists phone text,
  add column if not exists managed_by uuid references profiles(id) on delete set null,
  add column if not exists created_in_circle uuid references fund_circles(id) on delete set null,
  add column if not exists claimed_at timestamptz,
  add column if not exists claimed_by uuid;

-- ------------------------------------------------------------
-- 2. Repoint identity/subject FKs auth.users -> profiles
-- ------------------------------------------------------------
-- Existing data is already compatible: every user_id equals an
-- auth.users.id which equals a profiles.id, so these validate cleanly.

alter table fund_circle_members drop constraint fund_circle_members_user_id_fkey;
alter table fund_circle_members
  add constraint fund_circle_members_user_id_fkey
  foreign key (user_id) references profiles(id) on delete cascade;

alter table contributions drop constraint contributions_user_id_fkey;
alter table contributions
  add constraint contributions_user_id_fkey
  foreign key (user_id) references profiles(id) on delete cascade;

alter table loans drop constraint loans_user_id_fkey;
alter table loans
  add constraint loans_user_id_fkey
  foreign key (user_id) references profiles(id) on delete cascade;

alter table loans drop constraint loans_requested_by_fkey;
alter table loans
  add constraint loans_requested_by_fkey
  foreign key (requested_by) references profiles(id);

alter table contribution_payments drop constraint contribution_payments_submitted_by_fkey;
alter table contribution_payments
  add constraint contribution_payments_submitted_by_fkey
  foreign key (submitted_by) references profiles(id);

alter table loan_payments drop constraint loan_payments_submitted_by_fkey;
alter table loan_payments
  add constraint loan_payments_submitted_by_fkey
  foreign key (submitted_by) references profiles(id);

alter table circle_settlement_payouts drop constraint circle_settlement_payouts_user_id_fkey;
alter table circle_settlement_payouts
  add constraint circle_settlement_payouts_user_id_fkey
  foreign key (user_id) references profiles(id) on delete cascade;

-- ------------------------------------------------------------
-- 3. profiles RLS (defense-in-depth; pages read via service role)
-- ------------------------------------------------------------
-- A profile is selectable by anyone who shares a circle with it, so
-- managed members render (name/phone) for their circle co-members.
create policy "profiles_select_circle_comember" on profiles for select
  using (exists (
    select 1
    from fund_circle_members me
    join fund_circle_members them
      on them.fund_circle_id = me.fund_circle_id
    where me.user_id = auth.uid()
      and them.user_id = profiles.id
  ));

-- Admins/owners of some circle may create/update managed profiles only.
create policy "profiles_insert_admin_managed" on profiles for insert
  with check (
    is_managed = true
    and exists (
      select 1 from fund_circle_members fcm
      where fcm.user_id = auth.uid()
        and fcm.role in ('owner','admin')
        and fcm.active = true
    )
  );

create policy "profiles_update_admin_managed" on profiles for update
  using (
    is_managed = true
    and exists (
      select 1 from fund_circle_members fcm
      where fcm.user_id = auth.uid()
        and fcm.role in ('owner','admin')
        and fcm.active = true
    )
  );
