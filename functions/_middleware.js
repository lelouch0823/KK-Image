/**
 * Edge Middleware - SOTA JWT 验证
 * 在 Edge 层完成 JWT 验证，未授权用户无法看到任何 Admin HTML
 */

/**
 * 简易 JWT 验证（使用 Web Crypto API）
 * @param {string} token - JWT Token
 * @param {string} secret - JWT Secret
 * @returns {Promise<boolean>}
 */
async function verifyJWT(token, secret) {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return false;

    const [encodedHeader, encodedPayload, signature] = parts;

    // 验证签名
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );

    const signatureData = await crypto.subtle.sign(
      'HMAC',
      key,
      encoder.encode(`${encodedHeader}.${encodedPayload}`)
    );

    // 将签名转换为 Base64 URL 安全格式
    const base64 = btoa(String.fromCharCode(...new Uint8Array(signatureData)));
    const expectedSignature = base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

    if (signature !== expectedSignature) {
      return false;
    }

    // 解码 Payload 并检查过期时间
    let base64Payload = encodedPayload.replace(/-/g, '+').replace(/_/g, '/');
    const padding = base64Payload.length % 4;
    if (padding) base64Payload += '='.repeat(4 - padding);

    const payload = JSON.parse(decodeURIComponent(escape(atob(base64Payload))));

    // 检查过期时间
    if (payload.exp && Date.now() / 1000 > payload.exp) {
      return false;
    }

    return true;
  } catch (error) {
    console.error('[Edge Auth] JWT verification error:', error.message);
    return false;
  }
}

export async function onRequest(context) {
  const { request, next, env } = context;
  const url = new URL(request.url);
  const pathname = url.pathname;

  // API 路由由 Hono 处理，跳过此中间件
  if (pathname.startsWith('/api/')) {
    return next();
  }

  // 只保护 admin 相关页面
  const isAdminPath = pathname.includes('admin');
  if (!isAdminPath) {
    return next();
  }

  // 从 Cookie 中提取 JWT Token
  const cookieHeader = request.headers.get('Cookie') || '';
  const match = cookieHeader.match(/TELEG_AUTH=([^;]+)/);

  if (!match) {
    console.log(`[Edge Auth] No token for ${pathname}, redirecting to login`);
    return Response.redirect(`${url.origin}/login.html`, 302);
  }

  // 验证 JWT
  const jwtSecret = env.JWT_SECRET || 'default-secret-change-in-production';
  const isValid = await verifyJWT(match[1], jwtSecret);

  if (!isValid) {
    console.log(`[Edge Auth] Invalid/expired token for ${pathname}, redirecting to login`);
    // 清除无效的 Cookie
    return new Response(null, {
      status: 302,
      headers: {
        'Location': `${url.origin}/login.html`,
        'Set-Cookie': 'TELEG_AUTH=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Strict'
      }
    });
  }

  // Token 有效，允许访问
  return next();
}
