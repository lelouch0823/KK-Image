// 用户管理系统

import { ROLES, expandPermissions } from './permissions.js';
import { generateApiKey } from './auth.js';

// 用户状态
export const USER_STATUS = {
  ACTIVE: 'active',
  INACTIVE: 'inactive',
  SUSPENDED: 'suspended',
  PENDING: 'pending'
};

// 默认管理员用户
const DEFAULT_ADMIN = {
  id: 'admin',
  username: 'admin',
  name: 'Administrator',
  email: 'admin@example.com',
  role: 'admin',
  status: USER_STATUS.ACTIVE,
  permissions: ['admin'],
  createdAt: Date.now(),
  lastLoginAt: null,
  loginCount: 0
};

// 获取所有用户
export async function getUsers(env) {
  if (env.USERS_KV) {
    try {
      const users = await env.USERS_KV.get('users', 'json');
      if (users && Array.isArray(users)) {
        return users;
      }
    } catch (error) {
      console.error('Failed to get users from KV:', error);
    }
  }

  // 返回默认管理员用户
  return [DEFAULT_ADMIN];
}

// 根据用户名获取用户
export async function getUserByUsername(username, env) {
  const users = await getUsers(env);
  return users.find(user => user.username === username);
}

// 根据用户ID获取用户
export async function getUserById(userId, env) {
  const users = await getUsers(env);
  return users.find(user => user.id === userId);
}

// 创建新用户
export async function createUser(userData, env) {
  if (!env.USERS_KV) {
    throw new Error('Users KV namespace not configured');
  }

  // 验证必填字段
  if (!userData.username || !userData.password) {
    throw new Error('Username and password are required');
  }

  // 检查用户名是否已存在
  const existingUser = await getUserByUsername(userData.username, env);
  if (existingUser) {
    throw new Error('Username already exists');
  }

  // 验证角色
  if (userData.role && !ROLES[userData.role]) {
    throw new Error(`Invalid role: ${userData.role}`);
  }

  const newUser = {
    id: 'user_' + Date.now() + '_' + Math.random().toString(36).substring(2, 15),
    username: userData.username,
    name: userData.name || userData.username,
    email: userData.email || '',
    role: userData.role || 'viewer',
    permissions: userData.permissions || ROLES[userData.role || 'viewer'].permissions,
    status: userData.status || USER_STATUS.ACTIVE,
    passwordHash: await hashPassword(userData.password),
    createdAt: Date.now(),
    createdBy: userData.createdBy || 'system',
    lastLoginAt: null,
    loginCount: 0,
    metadata: userData.metadata || {}
  };

  // 保存用户
  const users = await getUsers(env);
  users.push(newUser);
  await env.USERS_KV.put('users', JSON.stringify(users));

  // 返回用户信息（不包含密码哈希）
  const { passwordHash, ...userInfo } = newUser;
  return userInfo;
}

// 更新用户
export async function updateUser(userId, updateData, env) {
  if (!env.USERS_KV) {
    throw new Error('Users KV namespace not configured');
  }

  const users = await getUsers(env);
  const userIndex = users.findIndex(user => user.id === userId);

  if (userIndex === -1) {
    throw new Error('User not found');
  }

  const user = users[userIndex];

  // 更新允许的字段
  if (updateData.name !== undefined) user.name = updateData.name;
  if (updateData.email !== undefined) user.email = updateData.email;
  if (updateData.role !== undefined) {
    if (!ROLES[updateData.role]) {
      throw new Error(`Invalid role: ${updateData.role}`);
    }
    user.role = updateData.role;
    user.permissions = ROLES[updateData.role].permissions;
  }
  if (updateData.permissions !== undefined) user.permissions = updateData.permissions;
  if (updateData.status !== undefined) user.status = updateData.status;
  if (updateData.metadata !== undefined) user.metadata = { ...user.metadata, ...updateData.metadata };

  // 如果更新密码
  if (updateData.password) {
    user.passwordHash = await hashPassword(updateData.password);
  }

  user.updatedAt = Date.now();
  user.updatedBy = updateData.updatedBy || 'system';

  users[userIndex] = user;
  await env.USERS_KV.put('users', JSON.stringify(users));

  // 返回用户信息（不包含密码哈希）
  const { passwordHash, ...userInfo } = user;
  return userInfo;
}

// 删除用户
export async function deleteUser(userId, env) {
  if (!env.USERS_KV) {
    throw new Error('Users KV namespace not configured');
  }

  const users = await getUsers(env);
  const filteredUsers = users.filter(user => user.id !== userId);

  if (filteredUsers.length === users.length) {
    throw new Error('User not found');
  }

  await env.USERS_KV.put('users', JSON.stringify(filteredUsers));
  return true;
}

// 验证用户凭据
export async function validateUserCredentials(username, password, env) {
  const user = await getUserByUsername(username, env);
  if (!user) {
    throw new Error('Invalid credentials');
  }

  // 检查用户状态
  if (user.status !== USER_STATUS.ACTIVE) {
    throw new Error(`User account is ${user.status}`);
  }

  // 验证密码
  const isValidPassword = await verifyPassword(password, user.passwordHash);
  if (!isValidPassword) {
    throw new Error('Invalid credentials');
  }

  // 更新登录信息
  await updateLoginInfo(user.id, env);

  // 返回用户信息（不包含密码哈希）
  const { passwordHash, ...userInfo } = user;
  return userInfo;
}

// 更新登录信息
async function updateLoginInfo(userId, env) {
  try {
    const users = await getUsers(env);
    const userIndex = users.findIndex(user => user.id === userId);

    if (userIndex !== -1) {
      users[userIndex].lastLoginAt = Date.now();
      users[userIndex].loginCount = (users[userIndex].loginCount || 0) + 1;

      if (env.USERS_KV) {
        await env.USERS_KV.put('users', JSON.stringify(users));
      }
    }
  } catch (error) {
    console.error('Failed to update login info:', error);
  }
}

// 生成随机盐（密码学安全）
function generateSalt(length = 16) {
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);
  return Array.from(array, b => b.toString(16).padStart(2, '0')).join('');
}

// PBKDF2 配置常量
const PBKDF2_ITERATIONS = 100000; // 迭代次数，提高暴力破解难度
const PBKDF2_KEY_LENGTH = 256;    // 派生密钥长度（位）

/**
 * 密码哈希（使用 PBKDF2 密钥派生函数）
 * 格式：pbkdf2:iterations:salt:hash
 */
async function hashPassword(password) {
  const salt = generateSalt(32); // 使用更长的盐
  const encoder = new TextEncoder();

  // 导入密码作为密钥材料
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    'PBKDF2',
    false,
    ['deriveBits']
  );

  // 使用 PBKDF2 派生密钥
  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: encoder.encode(salt),
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256'
    },
    keyMaterial,
    PBKDF2_KEY_LENGTH
  );

  const hash = Array.from(new Uint8Array(derivedBits))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');

  // 返回格式包含算法信息，便于未来升级
  return `pbkdf2:${PBKDF2_ITERATIONS}:${salt}:${hash}`;
}

/**
 * 密码验证（支持新旧格式，向后兼容）
 */
async function verifyPassword(password, storedHash) {
  const encoder = new TextEncoder();

  // 新格式：pbkdf2:iterations:salt:hash
  if (storedHash.startsWith('pbkdf2:')) {
    const parts = storedHash.split(':');
    if (parts.length !== 4) return false;

    const [, iterationsStr, salt, expectedHash] = parts;
    const iterations = parseInt(iterationsStr, 10);

    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      encoder.encode(password),
      'PBKDF2',
      false,
      ['deriveBits']
    );

    const derivedBits = await crypto.subtle.deriveBits(
      {
        name: 'PBKDF2',
        salt: encoder.encode(salt),
        iterations: iterations,
        hash: 'SHA-256'
      },
      keyMaterial,
      PBKDF2_KEY_LENGTH
    );

    const computedHash = Array.from(new Uint8Array(derivedBits))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');

    return computedHash === expectedHash;
  }

  // 兼容旧格式 V2（salt:hash - 简单 SHA-256）
  if (storedHash.includes(':') && !storedHash.startsWith('pbkdf2:')) {
    const [salt, hash] = storedHash.split(':');
    const data = encoder.encode(password + salt);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const computedHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    return computedHash === hash;
  }

  // 兼容旧格式 V1（固定盐 'salt'）
  const data = encoder.encode(password + 'salt');
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const legacyHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return legacyHash === storedHash;
}

// 生成用户 API Token
export async function generateUserApiToken(userId, env) {
  const user = await getUserById(userId, env);
  if (!user) {
    throw new Error('User not found');
  }

  const apiKey = generateApiKey();
  const tokenInfo = {
    id: 'token_' + Date.now() + '_' + Math.random().toString(36).substring(2, 15),
    key: apiKey,
    userId: userId,
    name: `${user.name} API Token`,
    permissions: user.permissions,
    createdAt: Date.now(),
    expiresAt: null,
    disabled: false
  };

  // 保存到用户的 API tokens
  if (env.USERS_KV) {
    const userTokensKey = `user_tokens_${userId}`;
    const existingTokens = await env.USERS_KV.get(userTokensKey, 'json') || [];
    existingTokens.push(tokenInfo);
    await env.USERS_KV.put(userTokensKey, JSON.stringify(existingTokens));
  }

  return tokenInfo;
}

// 获取用户统计信息
export async function getUserStats(env) {
  const users = await getUsers(env);

  // 初始化统计计数器（单次遍历完成所有统计）
  const stats = {
    total: users.length,
    active: 0,
    inactive: 0,
    suspended: 0,
    pending: 0,
    byRole: {},
    recentLogins: []
  };

  // 初始化角色计数
  for (const role of Object.keys(ROLES)) {
    stats.byRole[role] = 0;
  }

  // 单次遍历完成所有统计
  for (const user of users) {
    // 状态统计
    switch (user.status) {
      case USER_STATUS.ACTIVE: stats.active++; break;
      case USER_STATUS.INACTIVE: stats.inactive++; break;
      case USER_STATUS.SUSPENDED: stats.suspended++; break;
      case USER_STATUS.PENDING: stats.pending++; break;
    }

    // 角色统计
    if (user.role && stats.byRole[user.role] !== undefined) {
      stats.byRole[user.role]++;
    }

    // 收集有登录记录的用户用于排序
    if (user.lastLoginAt) {
      stats.recentLogins.push({
        id: user.id,
        name: user.name,
        username: user.username,
        lastLoginAt: user.lastLoginAt,
        loginCount: user.loginCount
      });
    }
  }

  // 只对有登录记录的用户排序并取前10
  stats.recentLogins = stats.recentLogins
    .sort((a, b) => b.lastLoginAt - a.lastLoginAt)
    .slice(0, 10);

  return stats;
}
