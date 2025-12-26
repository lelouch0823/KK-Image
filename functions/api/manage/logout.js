export async function onRequest(context) {
  return new Response(JSON.stringify({
    success: true,
    message: 'Logged out successfully'
  }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      // 清除认证缓存
      'Clear-Site-Data': '"cache", "cookies"'
    }
  });
}