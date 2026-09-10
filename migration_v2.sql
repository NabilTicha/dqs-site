-- Migration v2: add game_type to drill_scores
-- Run ONCE on the remote database BEFORE deploying the updated code:
--
--   npx wrangler d1 execute DB --command="ALTER TABLE drill_scores ADD COLUMN game_type TEXT NOT NULL DEFAULT '80in8'" --remote
--
-- Existing rows (all 80-in-8 scores) automatically receive game_type = '80in8'.

ALTER TABLE drill_scores ADD COLUMN game_type TEXT NOT NULL DEFAULT '80in8';

CREATE INDEX IF NOT EXISTS idx_drill_scores_game ON drill_scores(game_type);
