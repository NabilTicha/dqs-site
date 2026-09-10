import { getUser, jsonResponse, errorResponse } from '../../../shared/auth-middleware';

export const onRequestPost: CFPagesFunction = async ({ request, env }) => {
  const user = await getUser(request, env.JWT_SECRET);
  if (!user) return errorResponse('Unauthorized', 401);

  let body: {
    score?: number;
    correct?: number;
    wrong?: number;
    skipped?: number;
    duration_s?: number;
    game_type?: string;
  };
  try {
    body = await request.json() as typeof body;
  } catch {
    return errorResponse('Invalid JSON');
  }

  const { score, correct, wrong, skipped, duration_s } = body;
  const game_type = ['zapn', 'math'].includes(body.game_type ?? '') ? body.game_type! : '80in8';

  if (typeof score !== 'number') return errorResponse('Missing score');

  if (game_type === '80in8') {
    if (
      typeof correct !== 'number' ||
      typeof wrong !== 'number' ||
      typeof skipped !== 'number' ||
      typeof duration_s !== 'number'
    ) return errorResponse('Missing or invalid fields');

    if (correct + wrong + skipped > 80 || duration_s > 480 || duration_s < 0)
      return errorResponse('Invalid score data');

    if (correct - 2 * wrong - 2 * skipped !== score)
      return errorResponse('Score mismatch');
  } else {
    // zapn / math: score must be 0–100 (already normalized client-side)
    if (score < 0 || score > 100) return errorResponse('Score out of range');
  }

  const id = crypto.randomUUID();

  await env.DB.prepare(
    `INSERT INTO drill_scores (id, user_id, score, correct, wrong, skipped, duration_s, game_type)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(
      id, user.sub, score,
      typeof correct === 'number' ? correct : 0,
      typeof wrong   === 'number' ? wrong   : 0,
      typeof skipped === 'number' ? skipped : 0,
      typeof duration_s === 'number' ? duration_s : 0,
      game_type
    )
    .run();

  return jsonResponse({ ok: true, id });
};
