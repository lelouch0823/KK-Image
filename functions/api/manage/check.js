export async function onRequest(context) {
  const { env } = context;

  // 检查是否配置了 Basic Auth
  const isAuthConfigured = env.BASIC_USER && env.BASIC_USER !== '';

  return new Response(JSON.stringify({
    authEnabled: isAuthConfigured,
    message: isAuthConfigured ? 'Basic auth is enabled' : 'Basic auth is not configured'
  }), {
    headers: { 'Content-Type': 'application/json' }
  });
}