import { getUser, jsonResponse } from '../../../shared/auth-middleware';

/* Normalize a raw score to 0-100 based on game type.
   80in8: raw score can be negative (−2 per wrong); divide by max (80) and cap at [0,100].
   zapn / math: already submitted as 0-100 from the client. */
function normalize(raw: number, game_type: string): number {
  let n = raw;
  if (game_type === '80in8') n = Math.round((raw / 80) * 100);
  return n < 0 ? 0 : n > 100 ? 100 : n;
}

const NORM_EXPR = `
  CASE
    WHEN game_type = '80in8' THEN
      CASE WHEN ROUND(CAST(best_raw AS REAL) / 80.0 * 100) < 0 THEN 0
           WHEN ROUND(CAST(best_raw AS REAL) / 80.0 * 100) > 100 THEN 100
           ELSE ROUND(CAST(best_raw AS REAL) / 80.0 * 100) END
    ELSE
      CASE WHEN best_raw < 0 THEN 0 WHEN best_raw > 100 THEN 100
           ELSE CAST(best_raw AS REAL) END
  END
`;

export const onRequestGet: CFPagesFunction = async ({ request, env }) => {
  const lb = await env.DB.prepare(`
    WITH best AS (
      SELECT user_id, game_type, MAX(score) AS best_raw
      FROM drill_scores
      WHERE game_type IN ('80in8', 'zapn', 'math')
      GROUP BY user_id, game_type
    ),
    normed AS (
      SELECT user_id, game_type, ${NORM_EXPR} AS norm
      FROM best
    ),
    agg AS (
      SELECT
        user_id,
        ROUND(AVG(norm), 1)                               AS optiver_score,
        COUNT(DISTINCT game_type)                         AS modules,
        MAX(CASE WHEN game_type = '80in8' THEN norm END)  AS s_80in8,
        MAX(CASE WHEN game_type = 'zapn'  THEN norm END)  AS s_zapn,
        MAX(CASE WHEN game_type = 'math'  THEN norm END)  AS s_math
      FROM normed
      GROUP BY user_id
    )
    SELECT
      u.id           AS user_id,
      u.name,
      u.picture_url,
      a.optiver_score,
      a.modules,
      a.s_80in8,
      a.s_zapn,
      a.s_math,
      RANK() OVER (ORDER BY a.optiver_score DESC) AS rank
    FROM agg a
    JOIN users u ON u.id = a.user_id
    ORDER BY a.optiver_score DESC
    LIMIT 25
  `).all();

  const user = await getUser(request, env.JWT_SECRET);
  let personal = null;

  if (user) {
    const rows = await env.DB.prepare(`
      WITH best AS (
        SELECT game_type, MAX(score) AS best_raw
        FROM drill_scores
        WHERE user_id = ? AND game_type IN ('80in8','zapn','math')
        GROUP BY game_type
      )
      SELECT game_type, ${NORM_EXPR} AS norm
      FROM best
    `).bind(user.sub).all();

    if (rows.results.length > 0) {
      const r = rows.results as Array<{ game_type: string; norm: number }>;
      const avg = r.reduce((s, x) => s + x.norm, 0) / r.length;
      personal = {
        optiver_score: Math.round(avg * 10) / 10,
        by_game: Object.fromEntries(r.map(x => [x.game_type, x.norm])),
      };
    }
  }

  return jsonResponse({ leaderboard: lb.results, personal });
};
