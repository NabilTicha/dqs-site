import { signJWT } from '../../../../shared/jwt';

const encoder = new TextEncoder();
const STATE_TTL_SECONDS = 10 * 60;

// Defense in depth: even if MS_TENANT_ID is misconfigured (e.g., 'common'),
// only TU Delft addresses can complete the flow.
const ALLOWED_DOMAINS = ['tudelft.nl', 'student.tudelft.nl'];

function base64urlDecode(s: string): Uint8Array {
  s = s.replace(/-/g, '+').replace(/_/g, '/');
  while (s.length % 4) s += '=';
  const bin = atob(s);
  const buf = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
  return buf;
}

async function verifyState(state: string, secret: string): Promise<boolean> {
  const parts = state.split('.');
  if (parts.length !== 3) return false;
  const [nonce, ts, sigB64] = parts;

  const age = Math.floor(Date.now() / 1000) - parseInt(ts, 10);
  if (!isFinite(age) || age < -5 || age > STATE_TTL_SECONDS) return false;

  const key = await crypto.subtle.importKey(
    'raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']
  );
  const sig = base64urlDecode(sigB64);
  return crypto.subtle.verify('HMAC', key, sig.buffer as ArrayBuffer, encoder.encode(`${nonce}.${ts}`));
}

function emailDomain(email: string): string {
  const at = email.lastIndexOf('@');
  return at < 0 ? '' : email.slice(at + 1).toLowerCase();
}

export const onRequestGet: CFPagesFunction = async ({ request, env }) => {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');

  if (!code || !state) {
    return new Response('Missing code or state', { status: 400 });
  }

  const stateValid = await verifyState(state, env.JWT_SECRET);
  if (!stateValid) {
    return new Response('Invalid or expired state', { status: 403 });
  }

  const tenant = env.MS_TENANT_ID || 'organizations';
  const tokenRes = await fetch(`https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: env.MS_CLIENT_ID,
      client_secret: env.MS_CLIENT_SECRET,
      redirect_uri: env.MS_REDIRECT_URI,
      grant_type: 'authorization_code',
      scope: 'openid email profile User.Read',
    }),
  });

  if (!tokenRes.ok) {
    return new Response('Token exchange failed', { status: 500 });
  }

  const tokens = await tokenRes.json() as { access_token: string };

  const userInfoRes = await fetch('https://graph.microsoft.com/v1.0/me', {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  });

  if (!userInfoRes.ok) {
    return new Response('Failed to fetch user info', { status: 500 });
  }

  const userInfo = await userInfoRes.json() as {
    id: string;
    displayName: string;
    mail: string | null;
    userPrincipalName: string;
  };

  // Microsoft Graph: mail is the verified address; UPN is the login name and is
  // usually an email-shaped string too. Prefer mail, fall back to UPN.
  const email = (userInfo.mail || userInfo.userPrincipalName || '').toLowerCase();
  if (!email || !ALLOWED_DOMAINS.includes(emailDomain(email))) {
    return new Response('TU Delft account required (@tudelft.nl or @student.tudelft.nl).', { status: 403 });
  }

  const userId = crypto.randomUUID();

  // ON CONFLICT(email): a user who already exists (perhaps from the previous
  // Google flow) gets matched by email and their microsoft_id is filled in.
  await env.DB.prepare(`
    INSERT INTO users (id, microsoft_id, email, name, picture_url, last_login)
    VALUES (?1, ?2, ?3, ?4, ?5, datetime('now'))
    ON CONFLICT(email) DO UPDATE SET
      microsoft_id = excluded.microsoft_id,
      name = excluded.name,
      last_login = datetime('now')
  `).bind(userId, userInfo.id, email, userInfo.displayName || email, null).run();

  const dbUser = await env.DB.prepare(
    'SELECT id, email, name, picture_url FROM users WHERE email = ?1'
  ).bind(email).first<{ id: string; email: string; name: string; picture_url: string | null }>();

  if (!dbUser) {
    return new Response('Failed to create user', { status: 500 });
  }

  const jwt = await signJWT({
    sub: dbUser.id,
    email: dbUser.email,
    name: dbUser.name,
    picture: dbUser.picture_url || '',
  }, env.JWT_SECRET);

  const cookieHeader = `dqs_token=${jwt}; Path=/; HttpOnly; SameSite=Lax; Secure; Max-Age=${7 * 24 * 60 * 60}`;

  return new Response(null, {
    status: 302,
    headers: new Headers([
      ['Location', env.SITE_URL || '/'],
      ['Set-Cookie', cookieHeader],
    ]),
  });
};
