export const onRequestPost: CFPagesFunction = async ({ env }) => {
  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Set-Cookie': `dqs_token=; Path=/; HttpOnly; SameSite=Lax; Secure; Max-Age=0`,
    },
  });
};
