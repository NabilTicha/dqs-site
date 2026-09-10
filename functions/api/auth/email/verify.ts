import { jsonResponse, errorResponse } from '../../../../shared/auth-middleware';
import { signJWT } from '../../../../shared/jwt';
import {
  normalizeEmail,
  isAllowedEmail,
  hashCode,
  timingSafeEqual,
  displayNameFromEmail,
  MAX_ATTEMPTS,
} from '../../../../shared/email-auth';

export const onRequestPost: CFPagesFunction = async ({ request, env }) => {
  let body: { email?: string; code?: string };
  try {
    body = await request.json() as typeof body;
  } catch {
    return errorResponse('Invalid JSON');
  }

  const email = normalizeEmail(body.email);
  const code = typeof body.code === 'string' ? body.code.replace(/\D/g, '') : '';

  if (!email || !isAllowedEmail(email)) return errorResponse('Invalid email');
  if (code.length !== 6) return errorResponse('Enter the 6-digit code');

  const now = Math.floor(Date.now() / 1000);

  const row = await env.FORECAST_DB.prepare(`
    SELECT id, code_hash, attempts
    FROM email_codes
    WHERE email = ?1 AND consumed_at IS NULL AND expires_at > ?2
    ORDER BY created_at DESC
    LIMIT 1
  `).bind(email, now).first<{ id: string; code_hash: string; attempts: number }>();

  // Same message for "no code", "expired" and "already used": distinguishing
  // them tells an attacker which addresses have a live code outstanding.
  if (!row) return errorResponse('That code has expired. Request a new one.', 400);

  if (row.attempts >= MAX_ATTEMPTS) {
    await env.FORECAST_DB.prepare(
      'UPDATE email_codes SET consumed_at = ?2 WHERE id = ?1'
    ).bind(row.id, now).run();
    return errorResponse('Too many incorrect attempts. Request a new code.', 429);
  }

  // Count the attempt before comparing, so a client that abandons the request
  // mid-flight still burns it. Caps brute force at MAX_ATTEMPTS of 10^6.
  await env.FORECAST_DB.prepare(
    'UPDATE email_codes SET attempts = attempts + 1 WHERE id = ?1'
  ).bind(row.id).run();

  const candidate = await hashCode(email, code, env.JWT_SECRET);
  if (!timingSafeEqual(candidate, row.code_hash)) {
    const left = MAX_ATTEMPTS - (row.attempts + 1);
    return errorResponse(
      left > 0 ? `Incorrect code. ${left} attempt${left === 1 ? '' : 's'} left.` : 'Incorrect code. Request a new one.',
      400
    );
  }

  // Single use.
  await env.FORECAST_DB.prepare(
    'UPDATE email_codes SET consumed_at = ?2 WHERE id = ?1'
  ).bind(row.id, now).run();

  // Keyed on email, exactly as the Microsoft flow was, so any user rows that
  // predate this change are matched rather than duplicated. microsoft_id is
  // left alone: NULL for new rows, untouched for old ones.
  await env.FORECAST_DB.prepare(`
    INSERT INTO users (id, email, name, last_login)
    VALUES (?1, ?2, ?3, datetime('now'))
    ON CONFLICT(email) DO UPDATE SET last_login = datetime('now')
  `).bind(crypto.randomUUID(), email, displayNameFromEmail(email)).run();

  const dbUser = await env.FORECAST_DB.prepare(
    'SELECT id, email, name, picture_url FROM users WHERE email = ?1'
  ).bind(email).first<{ id: string; email: string; name: string; picture_url: string | null }>();

  if (!dbUser) return errorResponse('Failed to create user', 500);

  const jwt = await signJWT({
    sub: dbUser.id,
    email: dbUser.email,
    name: dbUser.name,
    picture: dbUser.picture_url || '',
  }, env.JWT_SECRET);

  return jsonResponse(
    { ok: true, user: { id: dbUser.id, email: dbUser.email, name: dbUser.name } },
    200,
    { 'Set-Cookie': `hq_token=${jwt}; Path=/; HttpOnly; SameSite=Lax; Secure; Max-Age=${7 * 24 * 60 * 60}` }
  );
};
