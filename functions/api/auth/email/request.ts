import { jsonResponse, errorResponse } from '../../../../shared/auth-middleware';
import {
  normalizeEmail,
  isAllowedEmail,
  generateCode,
  hashCode,
  sendCodeEmail,
  CODE_TTL_SECONDS,
  MAX_CODES_PER_EMAIL_PER_HOUR,
  MAX_CODES_PER_IP_PER_HOUR,
} from '../../../../shared/email-auth';

export const onRequestPost: CFPagesFunction = async ({ request, env }) => {
  let body: { email?: string };
  try {
    body = await request.json() as typeof body;
  } catch {
    return errorResponse('Invalid JSON');
  }

  const email = normalizeEmail(body.email);
  if (!email) return errorResponse('Missing email');
  if (!isAllowedEmail(email)) {
    return errorResponse('TU Delft account required (@tudelft.nl or @student.tudelft.nl).', 403);
  }

  const now = Math.floor(Date.now() / 1000);
  const hourAgo = now - 3600;
  const ip = request.headers.get('CF-Connecting-IP') || '';

  // Two independent limits: per address, so one mailbox cannot be flooded;
  // and per IP, so one client cannot spray codes at many addresses.
  const emailCount = await env.FORECAST_DB.prepare(
    'SELECT COUNT(*) AS n FROM email_codes WHERE email = ?1 AND created_at > ?2'
  ).bind(email, hourAgo).first<{ n: number }>();

  if ((emailCount?.n ?? 0) >= MAX_CODES_PER_EMAIL_PER_HOUR) {
    return errorResponse('Too many codes requested for this address. Try again in an hour.', 429);
  }

  if (ip) {
    const ipCount = await env.FORECAST_DB.prepare(
      'SELECT COUNT(*) AS n FROM email_codes WHERE request_ip = ?1 AND created_at > ?2'
    ).bind(ip, hourAgo).first<{ n: number }>();

    if ((ipCount?.n ?? 0) >= MAX_CODES_PER_IP_PER_HOUR) {
      return errorResponse('Too many sign-in attempts. Try again in an hour.', 429);
    }
  }

  // Any earlier live code for this address stops working the moment a new one
  // is issued, so a forwarded or shoulder-surfed old email is worthless.
  await env.FORECAST_DB.prepare(
    'UPDATE email_codes SET consumed_at = ?2 WHERE email = ?1 AND consumed_at IS NULL'
  ).bind(email, now).run();

  const code = generateCode();
  const codeHash = await hashCode(email, code, env.JWT_SECRET);
  const codeId = crypto.randomUUID();

  await env.FORECAST_DB.prepare(`
    INSERT INTO email_codes (id, email, code_hash, expires_at, request_ip, created_at)
    VALUES (?1, ?2, ?3, ?4, ?5, ?6)
  `).bind(
    codeId, email, codeHash, now + CODE_TTL_SECONDS, ip || null, now
  ).run();

  const sent = await sendCodeEmail(env, email, code);
  if (!sent) {
    // Drop the row rather than leave it counting against the rate limit: an
    // outage at Resend would otherwise lock a user out for an hour without
    // ever having delivered them a code.
    await env.FORECAST_DB.prepare('DELETE FROM email_codes WHERE id = ?1').bind(codeId).run();
    return errorResponse('Could not send the email. Try again in a moment.', 502);
  }

  // Cheap opportunistic sweep; the table is write-heavy and never read old.
  await env.FORECAST_DB.prepare(
    'DELETE FROM email_codes WHERE expires_at < ?1'
  ).bind(now - 86400).run();

  return jsonResponse({ ok: true, expires_in: CODE_TTL_SECONDS });
};
