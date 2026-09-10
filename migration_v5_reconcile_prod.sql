-- Migration v5: reconcile the production database with schema.sql.
--
-- Production drifted: migrations v2 and v3 were never applied remotely, and
-- drill_scores was never created there at all. Discovered 2026-08-27 while
-- deploying email sign-in — /api/drill/optiver-leaderboard was returning 500
-- (Worker exception, no such table) and score submission was silently failing.
--
-- Two problems, both fixed here:
--
--   1. users.google_id is still named google_id AND is NOT NULL. The email
--      sign-in flow supplies no external id at all, so any INSERT would fail
--      the constraint. SQLite cannot drop NOT NULL in place, so the table is
--      rebuilt. The legacy forecasts table references users(id), so foreign
--      key checks are deferred to commit (Cloudflare's documented pattern for
--      D1 table rebuilds). By then the rebuilt users table holds the same ids,
--      so every reference resolves and the check passes.
--
--   2. drill_scores is missing. Created with game_type already present, i.e.
--      the post-v2 shape, since there are no rows to migrate.
--
-- Existing user rows are preserved; their stale Google ids carry over into
-- microsoft_id, where they are simply ignored (nothing reads that column
-- under email auth).
--
-- Run ONCE on the remote database BEFORE deploying:
--
--   npx wrangler d1 execute DB --remote --file=migration_v5_reconcile_prod.sql
--
-- The legacy forecast tables (forecasts, forecast_grids, price_snapshots,
-- assets) are deliberately left alone. They belong to a removed feature and
-- are dead weight, but dropping them is a separate decision from this fix.

-- Order matters. SQLite tracks deferred FK violations as a running counter,
-- not a re-check at commit: dropping users adds one per orphaned forecast, and
-- only INSERTing matching parent rows afterwards takes them back off. So the
-- rows are parked in a backup, users is dropped and recreated, and the rows
-- are inserted into the new table last. (Copy-then-rename leaves the counter
-- stuck, because a rename never re-scans — tested, and D1 rejects it.)
PRAGMA defer_foreign_keys = true;

CREATE TABLE users_backup_v5 AS SELECT * FROM users;

DROP TABLE users;

CREATE TABLE users (
  id TEXT PRIMARY KEY,
  microsoft_id TEXT UNIQUE,
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  picture_url TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  last_login TEXT NOT NULL DEFAULT (datetime('now'))
);

INSERT INTO users (id, microsoft_id, email, name, picture_url, created_at, last_login)
  SELECT id, google_id, email, name, picture_url, created_at, last_login FROM users_backup_v5;

DROP TABLE users_backup_v5;

CREATE TABLE IF NOT EXISTS drill_scores (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL REFERENCES users(id),
  score       INTEGER NOT NULL,
  correct     INTEGER NOT NULL,
  wrong       INTEGER NOT NULL,
  skipped     INTEGER NOT NULL,
  duration_s  INTEGER NOT NULL,
  game_type   TEXT NOT NULL DEFAULT '80in8',  -- '80in8' | 'zapn' | 'math'
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_drill_scores_user  ON drill_scores(user_id);
CREATE INDEX IF NOT EXISTS idx_drill_scores_score ON drill_scores(score DESC);
CREATE INDEX IF NOT EXISTS idx_drill_scores_date  ON drill_scores(created_at);
CREATE INDEX IF NOT EXISTS idx_drill_scores_game  ON drill_scores(game_type);
