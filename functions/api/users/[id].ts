import { jsonResponse, errorResponse } from '../../../shared/auth-middleware';

export const onRequestGet: CFPagesFunction = async ({ params, env }) => {
  const id = params.id as string;

  const user = await env.DB.prepare(
    'SELECT id, name, picture_url, created_at FROM users WHERE id = ?1'
  ).bind(id).first();

  if (!user) return errorResponse('User not found', 404);

  const best = await env.DB.prepare(
    `SELECT score, correct, wrong, skipped, duration_s, created_at
     FROM drill_scores WHERE user_id = ?1
     ORDER BY score DESC, created_at ASC LIMIT 1`
  ).bind(id).first();

  const attempts = await env.DB.prepare(
    `SELECT COUNT(*) AS cnt FROM drill_scores WHERE user_id = ?1`
  ).bind(id).first<{ cnt: number }>();

  return jsonResponse({
    user,
    drill: best ? { best, attempts: attempts?.cnt ?? 0 } : null,
  });
};
