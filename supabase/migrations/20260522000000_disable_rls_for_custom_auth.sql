-- ====================================================================
-- Disable RLS on auth-critical tables so the custom (users-table-based)
-- authentication flow can read/write from the browser via the anon key.
-- ====================================================================
--
-- Context: this app does NOT use Supabase Auth. Login and signup go through
-- our own users table (name + password). Anonymous browser clients must be
-- able to:
--   * SELECT from users          (for login lookup)
--   * INSERT into users          (for customer self-signup)
--   * SELECT from otp_config     (to know if OTP is enabled)
--   * INSERT/UPDATE/DELETE on otp_attempts and otp_verified_phones
--
-- If RLS gets enabled on any of these by mistake (e.g. via the Supabase
-- dashboard UI), logins and signups silently fail. This migration restores
-- the correct state. It is idempotent and safe to re-run.
--
-- WARNING: this only undoes RLS on these specific tables. The Netlify
-- function fallback (authenticate-user.js) ALSO needs SUPABASE_SERVICE_ROLE_KEY
-- set in Netlify environment variables — without it, server-side auth will
-- return 503. This file only fixes the database side.
-- ====================================================================

alter table if exists users disable row level security;
alter table if exists otp_config disable row level security;
alter table if exists otp_attempts disable row level security;
alter table if exists otp_verified_phones disable row level security;

-- Ensure the anon role still has the privileges it needs after any prior
-- REVOKE. These grants are idempotent.
grant select, insert, update, delete on users to anon;
grant select on otp_config to anon;
grant select, insert, update, delete on otp_attempts to anon;
grant select, insert, update, delete on otp_verified_phones to anon;

-- Same for authenticated role, used by any Supabase-Auth path we may add.
grant select, insert, update, delete on users to authenticated;
grant select on otp_config to authenticated;
grant select, insert, update, delete on otp_attempts to authenticated;
grant select, insert, update, delete on otp_verified_phones to authenticated;
