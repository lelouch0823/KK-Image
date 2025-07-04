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

// 密码哈希（简单实现，生产环境建议使用更安全的方法）
async function hashPassword(password) {
  const encoder = new TextEncoder();
  const data = encoder.encode(password + 'salt'); // 简单加盐
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// 密码验证
async function verifyPassword(password, hash) {
  const passwordHash = await hashPassword(password);
  return passwordHash === hash;
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
  
  const stats = {
    total: users.length,
    active: users.filter(u => u.status === USER_STATUS.ACTIVE).length,
    inactive: users.filter(u => u.status === USER_STATUS.INACTIVE).length,
    suspended: users.filter(u => u.status === USER_STATUS.SUSPENDED).length,
    pending: users.filter(u => u.status === USER_STATUS.PENDING).length,
    byRole: {},
    recentLogins: users
      .filter(u => u.lastLoginAt)
      .sort((a, b) => b.lastLoginAt - a.lastLoginAt)
      .slice(0, 10)
      .map(u => ({
        id: u.id,
        name: u.name,
        username: u.username,
        lastLoginAt: u.lastLoginAt,
        loginCount: u.loginCount
      }))
  };
  
  // 按角色统计
  for (const role of Object.keys(ROLES)) {
    stats.byRole[role] = users.filter(u => u.role === role).length;
  }
  
  return stats;
}
