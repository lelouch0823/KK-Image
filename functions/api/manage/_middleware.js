async function errorHandling(context) {
  try {
    return await context.next();
  } catch (err) {
    return new Response(JSON.stringify({
      error: 'Internal server error',
      message: err.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}


import { verifyJWT } from '../utils/auth.js';
import { error } from '../utils/response.js';

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
    return error('Please bind a KV namespace to use this feature.', 503);
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
    return error('请先登录以访问此资源', 401);
  }

  // 6. 验证 Token
  return verifyJWT(token, env)
    .then(payload => {
      // 验证通过，将用户信息注入 context (使用 context.data 以确保持久化)
      if (!context.data) {
        context.data = {};
      }
      context.data.user = payload;
      // 保持向后兼容
      context.user = payload;
      return context.next();
    })
    .catch(err => {
      // 验证失败 (过期或无效)
      return error('登录已过期，请重新登录', 401);
    });
}

export const onRequest = [errorHandling, authentication];