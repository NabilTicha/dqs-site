-- Migration v3: swap Google OAuth → Microsoft OAuth (TU Delft NetID).
--
-- The auth column is renamed; existing rows keep their (now stale) Google
-- IDs in the renamed column. The callback matches by email on sign-in, so
-- pre-existing users get their microsoft_id overwritten with the real value
-- the first time they log in with Microsoft.
--
-- Run ONCE on the remote database BEFORE deploying the updated code:
--
--   npx wrangler d1 execute DB --remote --file=migration_v3_microsoft_auth.sql
--
-- Also: set MS_CLIENT_ID / MS_TENANT_ID / MS_REDIRECT_URI in wrangler.toml
-- and store MS_CLIENT_SECRET as an encrypted pages secret before deploy.

ALTER TABLE users RENAME COLUMN google_id TO microsoft_id;
