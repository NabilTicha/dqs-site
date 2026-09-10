-- Migration v4: email one-time-code sign-in (replaces Microsoft OAuth).
--
-- TU Delft blocks non-admins from registering Entra applications, so the
-- Microsoft flow could never be completed. Affiliation is now proven by
-- sending a 6-digit code to the @tudelft.nl / @student.tudelft.nl address
-- itself, which establishes exactly the same fact and depends on nothing
-- but a domain we own.
--
-- Run ONCE on the remote database BEFORE deploying the updated code:
--
--   npx wrangler d1 execute FORECAST_DB --remote --file=migration_v4_email_codes.sql
--
-- The users table is unchanged. users.microsoft_id simply stays NULL for
-- accounts created through this flow (SQLite permits many NULLs in a
-- UNIQUE column), so pre-existing rows keep working untouched.

CREATE TABLE IF NOT EXISTS email_codes (
  id          TEXT PRIMARY KEY,
  email       TEXT NOT NULL,
  -- HMAC-SHA256(JWT_SECRET, "email:code"), never the code itself: a dump of
  -- this table alone does not let an attacker sign in.
  code_hash   TEXT NOT NULL,
  expires_at  INTEGER NOT NULL,          -- unix seconds
  attempts    INTEGER NOT NULL DEFAULT 0,
  consumed_at INTEGER,                   -- unix seconds; NULL while unused
  request_ip  TEXT,
  created_at  INTEGER NOT NULL           -- unix seconds
);

-- Serves both "newest live code for this address" and the per-email rate limit.
CREATE INDEX IF NOT EXISTS idx_email_codes_email ON email_codes(email, created_at DESC);
-- Per-IP rate limit.
CREATE INDEX IF NOT EXISTS idx_email_codes_ip    ON email_codes(request_ip, created_at DESC);
-- Lets the opportunistic cleanup in request.ts stay cheap.
CREATE INDEX IF NOT EXISTS idx_email_codes_exp   ON email_codes(expires_at);
