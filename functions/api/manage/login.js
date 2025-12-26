import { generateJWT, verifyJWT } from '../utils/auth.js';

export async function onRequest(context) {
  const { request, env } = context;

  // 处理 POST 请求 (登录表单提交)
  if (request.method === 'POST') {
    try {
      const { username, password } = await request.json();

      // 验证必填字段
      if (!username || !password) {
        return new Response(JSON.stringify({ error: 'Username and password required', message: '请输入用户名和密码' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // 比较用户名和密码 (使用环境变量配置)
      // 注意：简单比较，生产环境应使用更安全的密码哈希
      if (username !== env.BASIC_USER || password !== env.BASIC_PASS) {

        // 延时防止爆破 (简单实现)
        await new Promise(resolve => setTimeout(resolve, 500 + Math.random() * 500));

        return new Response(JSON.stringify({ error: 'Invalid credentials', message: '用户名或密码错误' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // 登录成功，生成 JWT
      const user = {
        id: 'admin',
        name: username,
        permissions: ['admin', 'read', 'write', 'delete']
      };

      // Token 有效期 24 小时
      const token = await generateJWT(user, env, 86400);

      // 设置 Cookie
      const cookie = `TELEG_AUTH=${token}; HttpOnly; Path=/; Max-Age=86400; SameSite=Strict; Secure`;

      return new Response(JSON.stringify({ success: true, message: '登录成功' }), {
        headers: {
          'Content-Type': 'application/json',
          'Set-Cookie': cookie
        }
      });
    } catch (err) {
      return new Response(JSON.stringify({ error: 'Internal Server Error', message: err.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }

  // 处理 GET 请求 (重定向到登录页或 Admin 页)
  // 如果已登录，跳转 Admin；未登录，跳转 Login
  const cookieHeader = request.headers.get('Cookie');
  if (cookieHeader && cookieHeader.includes('TELEG_AUTH=')) {
    // 简单检查 Cookie 存在，验证交给 Middleware
    const url = new URL(request.url);
    return Response.redirect(`${url.origin}/admin.html`, 302);
  } else {
    const url = new URL(request.url);
    return Response.redirect(`${url.origin}/login.html`, 302);
  }
}