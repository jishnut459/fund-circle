-- ============================================================
-- 0009: Point audit_logs.user_id at profiles(id)
-- ============================================================
-- The audit-logs page embeds the actor's name via PostgREST
-- (`profiles!inner(name)`), which requires a declared foreign key
-- between audit_logs and profiles. Migration 0008 repointed the
-- other identity/subject FKs to profiles but left audit_logs out,
-- and the live table ended up with no user_id FK at all -- so the
-- embed could not resolve and the page always rendered empty even
-- though rows exist.
--
-- The actor (user_id) is always a real, logged-in user, whose
-- profiles.id equals their auth.users.id, so existing rows validate
-- cleanly against profiles.

alter table audit_logs drop constraint if exists audit_logs_user_id_fkey;
alter table audit_logs
  add constraint audit_logs_user_id_fkey
  foreign key (user_id) references profiles(id);
