async function errorHandling(context) {
  try {
    return await context.next();
  } catch (err) {
    // 记录完整错误到日志，但不暴露给客户端
    console.error('Manage API Error:', err.message, err.stack);
    return new Response(JSON.stringify({
      error: 'Internal server error',
      message: err.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

function basicAuthentication(request) {
  const Authorization = request.headers.get('Authorization');

  const [scheme, encoded] = Authorization.split(' ');

  // The Authorization header must start with Basic, followed by a space.
  if (!encoded || scheme !== 'Basic') {
    throw new BadRequestException('Malformed authorization header.');
  }

  // Decodes the base64 value and performs unicode normalization.
  // @see https://datatracker.ietf.org/doc/html/rfc7613#section-3.3.2 (and #section-4.2.2)
  // @see https://dev.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/String/normalize
  const buffer = Uint8Array.from(atob(encoded), character => character.charCodeAt(0));
  const decoded = new TextDecoder().decode(buffer).normalize();

  // The username & password are split by the first colon.
  //=> example: "username:password"
  const index = decoded.indexOf(':');

  // The user & password are split by the first colon and MUST NOT contain control characters.
  // @see https://tools.ietf.org/html/rfc5234#appendix-B.1 (=> "CTL = %x00-1F / %x7F")
  if (index === -1 || /[\0-\x1F\x7F]/.test(decoded)) {
    throw new BadRequestException('Invalid authorization value.');
  }

  return {
    user: decoded.substring(0, index),
    pass: decoded.substring(index + 1),
  };
}

function UnauthorizedException(reason) {
  return new Response(reason, {
    status: 401,
    statusText: 'Unauthorized',
    headers: {
      'Content-Type': 'text/plain;charset=UTF-8',
      // Disables caching by default.
      'Cache-Control': 'no-store',
      // Returns the "Content-Length" header for HTTP HEAD requests.
      'Content-Length': reason.length,
    },
  });
}

function BadRequestException(reason) {
  return new Response(reason, {
    status: 400,
    statusText: 'Bad Request',
    headers: {
      'Content-Type': 'text/plain;charset=UTF-8',
      // Disables caching by default.
      'Cache-Control': 'no-store',
      // Returns the "Content-Length" header for HTTP HEAD requests.
      'Content-Length': reason.length,
    },
  });
}


import { verifyJWT } from '../utils/auth.js';

function authentication(context) {
  const { env, request } = context;
  const url = new URL(request.url);

  // 1. 跳过登录接口和检查接口的认证，避免死循环
  // login: 登录本身不需要认证
  // check: 用于前端检查状态，如果未登录返回特定 JSON
  if (url.pathname.endsWith('/login') || url.pathname.endsWith('/check')) {
    return context.next();
  }

  // 2. 检查 KV 存储是否配置
  if (!env.img_url) {
    return new Response(JSON.stringify({
      error: 'Dashboard disabled',
      message: 'Please bind a KV namespace to use this feature.'
    }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // 3. 如果未配置 Basic Auth（即未启用认证），则直接放行
  if (!env.BASIC_USER) {
    return context.next();
  }

  // 4. 获取 Token (优先从 Cookie 获取，其次从 Authorization Header)
  let token = null;

  // 从 Cookie 获取
  const cookieHeader = request.headers.get('Cookie');
  if (cookieHeader) {
    const cookies = cookieHeader.split(';').reduce((acc, cookie) => {
      const [name, value] = cookie.trim().split('=');
      acc[name] = value;
      return acc;
    }, {});
    token = cookies['TELEG_AUTH'];
  }

  // 从 Authorization Header 获取 (支持 Bearer Token)
  if (!token && request.headers.has('Authorization')) {
    const authHeader = request.headers.get('Authorization');
    if (authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7);
    }
  }

  // 5. 如果没有 Token，拒绝访问
  if (!token) {
    return new Response(JSON.stringify({
      error: 'Authentication required',
      message: '请先登录以访问此资源'
    }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // 6. 验证 Token
  return verifyJWT(token, env)
    .then(payload => {
      // 验证通过，将用户信息注入 context (可选)
      context.user = payload;
      return context.next();
    })
    .catch(err => {
      // 验证失败 (过期或无效)
      return new Response(JSON.stringify({
        error: 'Invalid token',
        message: '登录已过期，请重新登录'
      }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    });
}

export const onRequest = [errorHandling, authentication];