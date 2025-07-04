// 权限管理 API
import { 
  PERMISSIONS, 
  PERMISSION_GROUPS, 
  ROLES, 
  hasPermission, 
  getUserPermissions,
  generatePermissionReport,
  requirePermission 
} from '../utils/permissions.js';

// 获取权限信息
export async function onRequestGet(context) {
  const { request } = context;
  const url = new URL(request.url);
  
  // 检查是否是权限定义端点
  if (url.pathname.endsWith('/definitions')) {
    return await getPermissionDefinitions(context);
  }
  
  // 检查是否是用户权限端点
  if (url.pathname.includes('/user')) {
    return await getUserPermissionInfo(context);
  }
  
  // 检查是否是角色端点
  if (url.pathname.includes('/roles')) {
    return await getRoles(context);
  }
  
  const error = new Error('Endpoint not found');
  error.name = 'NotFoundError';
  throw error;
}

// 获取权限定义
async function getPermissionDefinitions(context) {
  // 任何认证用户都可以查看权限定义
  try {
    return new Response(JSON.stringify({
      success: true,
      data: {
        permissions: PERMISSIONS,
        permissionGroups: PERMISSION_GROUPS,
        roles: ROLES
      }
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Error fetching permission definitions:', error);
    throw error;
  }
}

// 获取用户权限信息
async function getUserPermissionInfo(context) {
  try {
    const userPermissions = getUserPermissions(context.user);
    const report = generatePermissionReport(context.user);
    
    return new Response(JSON.stringify({
      success: true,
      data: {
        permissions: userPermissions,
        report: report
      }
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Error fetching user permissions:', error);
    throw error;
  }
}

// 获取角色信息
async function getRoles(context) {
  try {
    return new Response(JSON.stringify({
      success: true,
      data: ROLES
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Error fetching roles:', error);
    throw error;
  }
}

// 权限检查端点
export async function onRequestPost(context) {
  const { request } = context;
  const url = new URL(request.url);
  
  // 检查是否是权限验证端点
  if (url.pathname.endsWith('/check')) {
    return await checkPermissions(context);
  }
  
  const error = new Error('Endpoint not found');
  error.name = 'NotFoundError';
  throw error;
}

// 检查权限
async function checkPermissions(context) {
  const { request } = context;
  
  try {
    const { permissions } = await request.json();
    
    if (!Array.isArray(permissions)) {
      const error = new Error('Permissions must be an array');
      error.name = 'ValidationError';
      throw error;
    }
    
    const results = {};
    
    for (const permission of permissions) {
      results[permission] = hasPermission(context.user, permission);
    }
    
    return new Response(JSON.stringify({
      success: true,
      data: {
        user: {
          id: context.user.id,
          name: context.user.name,
          type: context.user.type
        },
        permissions: results,
        checkedAt: new Date().toISOString()
      }
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
    
  } catch (error) {
    console.error('Error checking permissions:', error);
    throw error;
  }
}
