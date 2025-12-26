// 认证工具模块 - 处理 API Key 和 JWT 认证

/**
 * JWT 实现 - 使用 URL-safe Base64 (RFC 4648) 和安全比较
 */
class SimpleJWT {
  /**
   * Base64 URL 安全编码（支持 Unicode）
   */
  static base64UrlEncode(data) {
    const str = typeof data === 'string' ? data : JSON.stringify(data);
    const encoded = btoa(unescape(encodeURIComponent(str)));
    // 转换为 URL 安全格式
    return encoded.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }

  /**
   * Base64 URL 安全解码
   */
  static base64UrlDecode(str) {
    // 还原标准 Base64
    let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
    // 补齐 padding
    const padding = base64.length % 4;
    if (padding) {
      base64 += '='.repeat(4 - padding);
    }
    return decodeURIComponent(escape(atob(base64)));
  }

  /**
   * 恒定时间字符串比较（防止时序攻击）
   */
  static constantTimeCompare(a, b) {
    if (a.length !== b.length) return false;
    let result = 0;
    for (let i = 0; i < a.length; i++) {
      result |= a.charCodeAt(i) ^ b.charCodeAt(i);
    }
    return result === 0;
  }

  /**
   * 编码 JWT Token（异步方法）
   */
  static async encode(payload, secret) {
    const header = { alg: 'HS256', typ: 'JWT' };
    const encodedHeader = this.base64UrlEncode(header);
    const encodedPayload = this.base64UrlEncode(payload);

    const signature = await this.sign(`${encodedHeader}.${encodedPayload}`, secret);

    return `${encodedHeader}.${encodedPayload}.${signature}`;
  }

  /**
   * 解码并验证 JWT Token（异步方法）
   */
  static async decode(token, secret) {
    const parts = token.split('.');
    if (parts.length !== 3) {
      throw new Error('Invalid token format');
    }

    const [encodedHeader, encodedPayload, signature] = parts;

    // 使用恒定时间比较防止时序攻击
    const expectedSignature = await this.sign(`${encodedHeader}.${encodedPayload}`, secret);
    if (!this.constantTimeCompare(signature, expectedSignature)) {
      throw new Error('Invalid token signature');
    }

    // 解码载荷
    const payload = JSON.parse(this.base64UrlDecode(encodedPayload));

    // 检查过期时间
    if (payload.exp && Date.now() / 1000 > payload.exp) {
      throw new Error('Token expired');
    }

    return payload;
  }

  /**
   * HMAC-SHA256 签名（返回 URL-safe Base64）
   */
  static async sign(data, secret) {
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );

    const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(data));
    const base64 = btoa(String.fromCharCode(...new Uint8Array(signature)));
    // 转换为 URL-safe 格式
    return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }
}

// 验证 API Key
export async function verifyApiKey(apiKey, env) {
  if (!apiKey) {
    throw new Error('API Key is required');
  }

  // 从环境变量或 KV 存储中获取有效的 API Keys
  const validApiKeys = await getValidApiKeys(env);

  const keyInfo = validApiKeys.find(key => key.key === apiKey);
  if (!keyInfo) {
    throw new Error('Invalid API Key');
  }

  // 检查 API Key 是否过期
  if (keyInfo.expiresAt && Date.now() > keyInfo.expiresAt) {
    throw new Error('API Key expired');
  }

  // 检查 API Key 是否被禁用
  if (keyInfo.disabled) {
    throw new Error('API Key disabled');
  }

  return {
    id: keyInfo.id,
    name: keyInfo.name,
    permissions: keyInfo.permissions || ['read'],
    type: 'api_key'
  };
}

// 验证 JWT Token
export async function verifyJWT(token, env) {
  if (!token) {
    throw new Error('JWT Token is required');
  }

  const jwtSecret = env.JWT_SECRET || 'default-secret-change-in-production';

  try {
    const payload = await SimpleJWT.decode(token, jwtSecret);

    return {
      id: payload.sub,
      name: payload.name,
      permissions: payload.permissions || ['read'],
      type: 'jwt',
      iat: payload.iat,
      exp: payload.exp
    };
  } catch (error) {
    throw new Error(`JWT verification failed: ${error.message}`);
  }
}

// 生成 JWT Token
export async function generateJWT(user, env, expiresIn = 3600) {
  const jwtSecret = env.JWT_SECRET || 'default-secret-change-in-production';
  const now = Math.floor(Date.now() / 1000);

  const payload = {
    sub: user.id,
    name: user.name,
    permissions: user.permissions || ['read'],
    iat: now,
    exp: now + expiresIn
  };

  return await SimpleJWT.encode(payload, jwtSecret);
}

// 生成 API Key
export function generateApiKey() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = 'tk_';
  for (let i = 0; i < 32; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// 获取有效的 API Keys
async function getValidApiKeys(env) {
  // 首先尝试从 KV 存储获取
  if (env.API_KEYS_KV) {
    try {
      const keys = await env.API_KEYS_KV.get('api_keys', 'json');
      if (keys && Array.isArray(keys)) {
        return keys;
      }
    } catch (error) {
      console.error('Failed to get API keys from KV:', error);
    }
  }

  // 如果 KV 中没有，使用环境变量中的默认 API Key
  const defaultApiKey = env.DEFAULT_API_KEY;
  if (defaultApiKey) {
    return [{
      id: 'default',
      key: defaultApiKey,
      name: 'Default API Key',
      permissions: ['read', 'write', 'delete'],
      createdAt: Date.now(),
      disabled: false
    }];
  }

  // 如果都没有，返回空数组
  return [];
}

// 保存 API Key 到 KV 存储
export async function saveApiKey(keyInfo, env) {
  if (!env.API_KEYS_KV) {
    throw new Error('API Keys KV namespace not configured');
  }

  const existingKeys = await getValidApiKeys(env);
  const updatedKeys = existingKeys.filter(k => k.id !== keyInfo.id);
  updatedKeys.push(keyInfo);

  await env.API_KEYS_KV.put('api_keys', JSON.stringify(updatedKeys));

  return keyInfo;
}

// 删除 API Key
export async function deleteApiKey(keyId, env) {
  if (!env.API_KEYS_KV) {
    throw new Error('API Keys KV namespace not configured');
  }

  const existingKeys = await getValidApiKeys(env);
  const updatedKeys = existingKeys.filter(k => k.id !== keyId);

  await env.API_KEYS_KV.put('api_keys', JSON.stringify(updatedKeys));

  return true;
}

// 检查权限
export function hasPermission(user, requiredPermission) {
  if (!user || !user.permissions) {
    return false;
  }

  // 管理员权限可以访问所有资源
  if (user.permissions.includes('admin')) {
    return true;
  }

  return user.permissions.includes(requiredPermission);
}

// 权限装饰器
export function requirePermission(permission) {
  return function (context) {
    if (!hasPermission(context.user, permission)) {
      const error = new Error(`Permission '${permission}' required`);
      error.name = 'AuthorizationError';
      throw error;
    }
    return context.next();
  };
}
