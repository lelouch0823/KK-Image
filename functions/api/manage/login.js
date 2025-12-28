import { generateJWT, verifyJWT } from '../utils/auth.js';

/**
 * 验证 Cloudflare Turnstile Token
 * @param {string} token - 前端提交的 Turnstile Token
 * @param {string} secretKey - Turnstile Secret Key
 * @param {string} ip - 用户 IP (可选)
 * @returns {Promise<{success: boolean, error_codes?: string[]}>}
 */
async function verifyTurnstile(token, secretKey, ip) {
  const formData = new URLSearchParams();
  formData.append('secret', secretKey);
  formData.append('response', token);
  if (ip) formData.append('remoteip', ip);

  const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'POST',
    body: formData
  });
  return res.json();
}

export async function onRequest(context) {
  const { request, env } = context;

  // 处理 POST 请求 (登录表单提交)
  if (request.method === 'POST') {
    try {
      const body = await request.json();
      const { username, password } = body;
      const turnstileToken = body['cf-turnstile-response'] || body.turnstileToken;

      // 验证必填字段
      if (!username || !password) {
        return new Response(JSON.stringify({ error: 'Username and password required', message: '请输入用户名和密码' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // Turnstile 验证 (如果配置了 Secret Key)
      if (env.TURNSTILE_SECRET_KEY) {
        if (!turnstileToken) {
          return new Response(JSON.stringify({ error: 'Turnstile token required', message: '请完成人机验证' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' }
          });
        }

        const clientIP = request.headers.get('CF-Connecting-IP');
        const turnstileResult = await verifyTurnstile(turnstileToken, env.TURNSTILE_SECRET_KEY, clientIP);

        if (!turnstileResult.success) {
          console.warn('Turnstile verification failed:', turnstileResult['error-codes']);
          return new Response(JSON.stringify({ error: 'Turnstile verification failed', message: '人机验证失败，请刷新页面重试' }), {
            status: 403,
            headers: { 'Content-Type': 'application/json' }
          });
        }
      }

      // 比较用户名和密码 (使用环境变量配置)
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
  const cookieHeader = request.headers.get('Cookie');
  if (cookieHeader && cookieHeader.includes('TELEG_AUTH=')) {
    const url = new URL(request.url);
    return Response.redirect(`${url.origin}/admin.html`, 302);
  } else {
    const url = new URL(request.url);
    return Response.redirect(`${url.origin}/login.html`, 302);
  }
}