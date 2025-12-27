// 用户管理 API
import {
  getUsers,
  getUserById,
  createUser,
  updateUser,
  deleteUser,
  generateUserApiToken,
  getUserStats
} from '../utils/users.js';
import { requirePermission, hasPermission } from '../utils/permissions.js';

// 获取用户列表或单个用户
export async function onRequestGet(context) {
  const { request, env } = context;
  // 获取用户信息
  const user = context.data?.user || context.user;

  const url = new URL(request.url);
  const pathParts = url.pathname.split('/');
  const userId = pathParts[pathParts.length - 1];

  // 检查是否是统计端点
  if (url.pathname.endsWith('/stats')) {
    return await getUserStatsEndpoint(context);
  }

  // 检查是否是获取单个用户
  if (userId && userId !== 'users' && !url.pathname.endsWith('/stats')) {
    return await getSingleUser(context, userId);
  }

  // 获取用户列表
  return await getUserList(context);
}

// 创建用户
export async function onRequestPost(context) {
  const { request, env } = context;
  const url = new URL(request.url);

  // 检查是否是生成 API Token 端点
  if (url.pathname.includes('/token')) {
    const pathParts = url.pathname.split('/');
    const userId = pathParts[pathParts.length - 2]; // /users/{userId}/token
    return await generateApiToken(context, userId);
  }

  // 创建新用户
  return await createNewUser(context);
}

// 更新用户
export async function onRequestPut(context) {
  const { request } = context;
  const url = new URL(request.url);
  const pathParts = url.pathname.split('/');
  const userId = pathParts[pathParts.length - 1];

  return await updateExistingUser(context, userId);
}

// 删除用户
export async function onRequestDelete(context) {
  const { request } = context;
  const url = new URL(request.url);
  const pathParts = url.pathname.split('/');
  const userId = pathParts[pathParts.length - 1];

  return await deleteExistingUser(context, userId);
}

// 获取用户列表
async function getUserList(context) {
  const { env } = context;

  // 检查权限
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

// 获取单个用户
async function getSingleUser(context, userId) {
  const { env } = context;
  const user = context.data?.user || context.user;

  // 用户可以查看自己的信息，管理员可以查看所有用户
  if (user.id !== userId) {
    requirePermission('admin:full')(context);
  }

  try {
    const user = await getUserById(userId, env);

    if (!user) {
      const error = new Error('User not found');
      error.name = 'NotFoundError';
      throw error;
    }

    // 移除敏感信息
    const { passwordHash, ...safeUser } = user;

    return new Response(JSON.stringify({
      success: true,
      data: safeUser
    }), {
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error fetching user:', error);
    throw error;
  }
}

// 创建新用户
async function createNewUser(context) {
  const { request, env } = context;

  // 检查权限
  requirePermission('admin:full')(context);

  try {
    const userData = await request.json();

    // 添加创建者信息
    const user = context.data?.user || context.user;
    userData.createdBy = user.id;

    const newUser = await createUser(userData, env);

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

// 更新用户
async function updateExistingUser(context, userId) {
  const { request, env } = context;

  // 获取用户信息
  const user = context.data?.user || context.user;

  // 用户可以更新自己的部分信息，管理员可以更新所有信息
  if (user.id !== userId) {
    requirePermission('admin:full')(context);
  }

  try {
    let updateData = await request.json();

    // 非管理员用户只能更新有限的字段
    if (user.id === userId && !hasPermission(user, 'admin:full')) {
      const allowedFields = ['name', 'email', 'password'];
      const filteredData = {};

      for (const field of allowedFields) {
        if (updateData[field] !== undefined) {
          filteredData[field] = updateData[field];
        }
      }

      updateData = filteredData;
    }

    // 添加更新者信息
    updateData.updatedBy = user.id;

    const updatedUser = await updateUser(userId, updateData, env);

    return new Response(JSON.stringify({
      success: true,
      data: updatedUser
    }), {
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error updating user:', error);
    throw error;
  }
}

// 删除用户
async function deleteExistingUser(context, userId) {
  const { env } = context;

  // 获取用户信息
  const user = context.data?.user || context.user;

  // 检查权限：只能删除自己，除非是管理员
  // 但不能删除自己（为了防止系统由于没有管理员而不可用）
  if (user.id === userId) {
    const error = new Error('Cannot delete your own account');
    error.name = 'ValidationError';
    throw error;
  }

  // 如果不是删除自己的账户，则需要管理员权限
  if (!hasPermission(user, 'admin:full')) {
    requirePermission('admin:full')(context); // This will throw if not admin
  }

  try {
    await deleteUser(userId, env);

    return new Response(JSON.stringify({
      success: true,
      message: 'User deleted successfully'
    }), {
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error deleting user:', error);
    throw error;
  }
}

// 生成用户 API Token
async function generateApiToken(context, userId) {
  const { env } = context;

  // 获取用户信息
  const user = context.data?.user || context.user;

  // 用户可以为自己生成 Token，管理员可以为任何用户生成
  if (user.id !== userId) {
    requirePermission('admin:full')(context);
  }

  try {
    const tokenInfo = await generateUserApiToken(userId, env);

    return new Response(JSON.stringify({
      success: true,
      data: tokenInfo
    }), {
      status: 201,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error generating API token:', error);
    throw error;
  }
}

// 获取用户统计信息
async function getUserStatsEndpoint(context) {
  const { env } = context;

  // 检查权限
  requirePermission('stats:read')(context);

  try {
    const stats = await getUserStats(env);

    return new Response(JSON.stringify({
      success: true,
      data: stats
    }), {
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error fetching user stats:', error);
    throw error;
  }
}
