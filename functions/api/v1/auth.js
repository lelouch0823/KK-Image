// 认证管理 API
import { hasPermission, generateJWT, generateApiKey, saveApiKey, deleteApiKey } from '../utils/auth.js';
import { requirePermission } from '../utils/permissions.js';
import { validateUserCredentials, createUser as createUserInDB, getUserStats, getUsers } from '../utils/users.js';

// 生成 JWT Token
export async function onRequestPost(context) {
  const { request, env } = context;
  const url = new URL(request.url);

  // 检查是否是 token 端点
  if (url.pathname.endsWith('/token')) {
    return await generateToken(context);
  }

  // 检查是否是 api-keys 端点
  if (url.pathname.includes('/api-keys')) {
    return await createApiKey(context);
  }

  // 检查是否是 users 端点
  if (url.pathname.includes('/users')) {
    return await createUser(context);
  }

  const error = new Error('Endpoint not found');
  error.name = 'NotFoundError';
  throw error;
}

// 生成 JWT Token
async function generateToken(context) {
  const { request, env } = context;

  try {
    const credentials = await request.json();

    // 这里应该验证用户凭据，为了演示简化处理
    if (!credentials.username || !credentials.password) {
      const error = new Error('Username and password are required');
      error.name = 'ValidationError';
      throw error;
    }

    // 使用用户管理系统验证凭据
    let user;
    try {
      user = await validateUserCredentials(credentials.username, credentials.password, env);
    } catch (error) {
      const authError = new Error('Invalid credentials');
      authError.name = 'AuthenticationError';
      throw authError;
    }

    const expiresIn = credentials.expiresIn || 3600; // 默认1小时
    const token = await generateJWT(user, env, expiresIn);

    return new Response(JSON.stringify({
      success: true,
      data: {
        token: token,
        tokenType: 'Bearer',
        expiresIn: expiresIn,
        user: {
          id: user.id,
          name: user.name,
          permissions: user.permissions
        }
      }
    }), {
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error generating token:', error);
    throw error;
  }
}

// 创建 API Key
async function createApiKey(context) {
  const { request, env } = context;

  // 获取用户信息
  const user = context.data?.user || context.user;

  // 检查管理员权限
  if (!hasPermission(user, 'admin')) {
    const error = new Error('Admin permission required');
    error.name = 'AuthorizationError';
    throw error;
  }

  try {
    const keyConfig = await request.json();

    // 验证配置
    if (!keyConfig.name) {
      const error = new Error('API Key name is required');
      error.name = 'ValidationError';
      throw error;
    }

    // 生成 API Key
    const apiKey = generateApiKey();

    const keyInfo = {
      id: 'key_' + Date.now() + '_' + Math.random().toString(36).substring(2, 15),
      key: apiKey,
      name: keyConfig.name,
      permissions: keyConfig.permissions || ['read'],
      createdAt: Date.now(),
      created: Date.now(),
      createdBy: user.name || user.id,
      expiresAt: keyConfig.expiresAt || null,
      disabled: false
    };

    // 保存到 KV 存储
    await saveApiKey(keyInfo, env);

    // 返回响应（不包含完整的 key，只显示前几位）
    const responseData = {
      ...keyInfo,
      key: apiKey.substring(0, 8) + '...' + apiKey.substring(apiKey.length - 4)
    };

    return new Response(JSON.stringify({
      success: true,
      data: responseData,
      fullKey: apiKey // 只在创建时返回完整 key
    }), {
      status: 201,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error creating API key:', error);
    throw error;
  }
}

// 获取 API Keys 列表
export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);

  // 检查是否是 api-keys 端点
  if (url.pathname.includes('/api-keys')) {
    return await listApiKeys(context);
  }

  // 检查是否是 users 端点
  if (url.pathname.includes('/users')) {
    return await listUsers(context);
  }

  // 检查是否是 stats 端点
  if (url.pathname.includes('/stats')) {
    return await getAuthStats(context);
  }

  const error = new Error('Endpoint not found');
  error.name = 'NotFoundError';
  throw error;
}

// 删除 API Key
export async function onRequestDelete(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const keyId = url.pathname.split('/').pop();

  // 获取用户信息
  const user = context.data?.user || context.user;

  // 检查管理员权限
  if (!hasPermission(user, 'admin')) {
    const error = new Error('Admin permission required');
    error.name = 'AuthorizationError';
    throw error;
  }

  try {
    await deleteApiKey(keyId, env);

    return new Response(JSON.stringify({
      success: true,
      message: 'API Key deleted successfully'
    }), {
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error deleting API key:', error);
    throw error;
  }
}

// 获取有效的 API Keys（内部函数）
async function getValidApiKeys(env) {
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

  return [];
}

// 创建用户
async function createUser(context) {
  const { request, env } = context;

  // 检查管理员权限
  requirePermission('admin:full')(context);

  try {
    const userData = await request.json();

    // 创建用户
    const newUser = await createUserInDB(userData, env);

    return new Response(JSON.stringify({
      success: true,
      data: newUser
    }), {
      status: 201,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error creating user:', error);
    throw error;
  }
}

// 列出 API Keys
async function listApiKeys(context) {
  const { env } = context;

  // 检查管理员权限
  requirePermission('apikeys:read')(context);

  try {
    // 获取有效的 API Keys（不包含实际的 key 值）
    const validApiKeys = await getValidApiKeys(env);

    const apiKeys = validApiKeys.map(key => ({
      id: key.id,
      name: key.name,
      permissions: key.permissions,
      createdAt: key.createdAt,
      createdBy: key.createdBy,
      expiresAt: key.expiresAt,
      disabled: key.disabled,
      key: key.key ? key.key.substring(0, 8) + '...' + key.key.substring(key.key.length - 4) : 'hidden'
    }));

    return new Response(JSON.stringify({
      success: true,
      data: apiKeys
    }), {
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error fetching API keys:', error);
    throw error;
  }
}

// 列出用户
async function listUsers(context) {
  const { env } = context;

  // 检查管理员权限
  requirePermission('admin:full')(context);

  try {
    const users = await getUsers(env);

    // 移除敏感信息
    const safeUsers = users.map(user => {
      const { passwordHash, ...safeUser } = user;
      return safeUser;
    });

    return new Response(JSON.stringify({
      success: true,
      data: safeUsers
    }), {
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error fetching users:', error);
    throw error;
  }
}

// 获取认证统计信息
async function getAuthStats(context) {
  const { env } = context;

  // 检查统计权限
  requirePermission('stats:read')(context);

  try {
    const userStats = await getUserStats(env);
    const apiKeys = await getValidApiKeys(env);

    const stats = {
      users: userStats,
      apiKeys: {
        total: apiKeys.length,
        active: apiKeys.filter(k => !k.disabled).length,
        expired: apiKeys.filter(k => k.expiresAt && Date.now() > k.expiresAt).length
      },
      generatedAt: new Date().toISOString()
    };

    return new Response(JSON.stringify({
      success: true,
      data: stats
    }), {
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error fetching auth stats:', error);
    throw error;
  }
}
