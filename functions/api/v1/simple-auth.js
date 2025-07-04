// 简化的认证端点用于测试
export async function onRequestPost(context) {
  const { request, env } = context;
  
  try {
    const credentials = await request.json();
    
    if (!credentials.username || !credentials.password) {
      return new Response(JSON.stringify({
        error: 'Username and password are required'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // 简单的硬编码验证用于测试
    if (credentials.username === 'admin' && credentials.password === '123') {
      return new Response(JSON.stringify({
        success: true,
        data: {
          token: 'test-token-123',
          tokenType: 'Bearer',
          expiresIn: 3600,
          user: {
            id: 'admin',
            name: 'Administrator',
            permissions: ['admin:full']
          }
        }
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
    } else {
      return new Response(JSON.stringify({
        error: 'Invalid credentials'
      }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
  } catch (error) {
    return new Response(JSON.stringify({
      error: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
