export async function onRequest(context) {
  const { request } = context;
  const url = new URL(request.url);

  // 清除 Cookie
  const cookie = `TELEG_AUTH=; HttpOnly; Path=/; Max-Age=0; SameSite=Strict; Secure`;

  return new Response(null, {
    status: 302,
    headers: {
      'Location': `${url.origin}/login.html`,
      'Set-Cookie': cookie
    }
  });
}