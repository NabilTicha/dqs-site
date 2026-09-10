-- Delft Quant Society Schema (80-in-8 drill)

DROP TABLE IF EXISTS drill_scores;
DROP TABLE IF EXISTS users;

CREATE TABLE users (
  id TEXT PRIMARY KEY,
  microsoft_id TEXT UNIQUE,
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  picture_url TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  last_login TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE drill_scores (
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

CREATE INDEX idx_drill_scores_user  ON drill_scores(user_id);
CREATE INDEX idx_drill_scores_score ON drill_scores(score DESC);
CREATE INDEX idx_drill_scores_date  ON drill_scores(created_at);
