import { verifyJWT, type JWTPayload } from './jwt';

export async function getUser(request: Request, jwtSecret: string): Promise<JWTPayload | null> {
  const cookie = request.headers.get('Cookie') || '';
  const match = cookie.match(/(?:^|;\s*)dqs_token=([^;]+)/);
  if (!match) return null;
  return verifyJWT(match[1], jwtSecret);
}

export function jsonResponse(data: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  });
}

export function errorResponse(message: string, status = 400): Response {
  return jsonResponse({ error: message }, status);
}
