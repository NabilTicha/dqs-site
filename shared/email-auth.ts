const encoder = new TextEncoder();

// Same allowlist the Microsoft callback enforced. Sending the code to the
// address *is* the check here, so this is the only gate on affiliation.
export const ALLOWED_DOMAINS = ['tudelft.nl', 'student.tudelft.nl'];

export const CODE_TTL_SECONDS = 10 * 60;
export const MAX_ATTEMPTS = 5;
export const MAX_CODES_PER_EMAIL_PER_HOUR = 5;
export const MAX_CODES_PER_IP_PER_HOUR = 15;

function base64url(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function normalizeEmail(raw: unknown): string {
  return typeof raw === 'string' ? raw.trim().toLowerCase() : '';
}

export function emailDomain(email: string): string {
  const at = email.lastIndexOf('@');
  return at < 0 ? '' : email.slice(at + 1);
}

export function isAllowedEmail(email: string): boolean {
  // Deliberately strict: one @, no whitespace, something either side.
  if (!/^[^\s@]+@[^\s@]+$/.test(email)) return false;
  return ALLOWED_DOMAINS.includes(emailDomain(email));
}

/* Uniform 6-digit code. Rejection sampling rather than a bare `% 1000000`,
   which would bias the low codes and shrink the effective search space. */
export function generateCode(): string {
  const buf = new Uint32Array(1);
  const limit = Math.floor(0x100000000 / 1000000) * 1000000;
  let n: number;
  do {
    crypto.getRandomValues(buf);
    n = buf[0];
  } while (n >= limit);
  return String(n % 1000000).padStart(6, '0');
}

/* Keyed hash, not a plain digest: a 6-digit code has only 10^6 possible
   values, so an unkeyed SHA-256 of it is trivially reversed by brute force.
   Binding the email in prevents a hash from being replayed for another
   address. */
export async function hashCode(email: string, code: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(`${email}:${code}`));
  return base64url(sig);
}

export function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/* Leaderboard display name, derived from the address since there is no
   directory to ask. "n.tichattibin@tudelft.nl" -> "N. Tichattibin". */
export function displayNameFromEmail(email: string): string {
  const local = email.slice(0, email.lastIndexOf('@'));
  const parts = local.split(/[._\-+]+/).filter(Boolean);
  if (parts.length === 0) return email;
  return parts
    .map(p => (p.length === 1 ? p.toUpperCase() + '.' : p.charAt(0).toUpperCase() + p.slice(1)))
    .join(' ');
}

export async function sendCodeEmail(env: Env, email: string, code: string): Promise<boolean> {
  const subject = `${code} is your Delft Quant Society sign-in code`;

  const text = [
    `Your Delft Quant Society sign-in code is ${code}`,
    ``,
    `It expires in 10 minutes and can be used once.`,
    `If you didn't request this, you can ignore this email.`,
  ].join('\n');

  const html = `
<div style="background:#0B0D10;padding:40px 24px;font-family:Inter,system-ui,-apple-system,sans-serif">
  <div style="max-width:440px;margin:0 auto;background:#111318;border:1px solid rgba(184,156,75,0.16);padding:32px">
    <div style="font-family:'IBM Plex Mono',ui-monospace,monospace;font-size:11px;letter-spacing:0.08em;text-transform:uppercase;color:#B89C4B;margin-bottom:20px">
      Delft Quant Society
    </div>
    <div style="color:#e8e8ef;font-size:16px;margin-bottom:24px">Your sign-in code</div>
    <div style="font-family:'IBM Plex Mono',ui-monospace,monospace;font-size:34px;letter-spacing:0.18em;color:#e8e8ef;background:#0B0D10;border:1px solid rgba(184,156,75,0.16);padding:18px;text-align:center">
      ${code}
    </div>
    <div style="color:#858592;font-size:13px;line-height:1.6;margin-top:24px">
      Expires in 10 minutes and can be used once.<br />
      If you didn't request this, you can ignore this email.
    </div>
  </div>
</div>`.trim();

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ from: env.EMAIL_FROM, to: [email], subject, text, html }),
  });

  if (!res.ok) {
    // Body may carry a Resend diagnostic (unverified domain, bad key). Log it
    // for `wrangler pages deployment tail`; never surface it to the caller.
    console.error('Resend send failed', res.status, await res.text().catch(() => ''));
    return false;
  }
  return true;
}
