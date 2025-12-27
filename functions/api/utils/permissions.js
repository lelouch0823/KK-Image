// 权限管理系统 - 细粒度权限控制

// 权限定义
export const PERMISSIONS = {
  // 文件权限
  'files:read': '查看文件信息',
  'files:list': '列出文件',
  'files:upload': '上传文件',
  'files:update': '更新文件信息',
  'files:delete': '删除文件',
  'files:download': '下载文件',

  // API Key 权限
  'apikeys:read': '查看 API Key',
  'apikeys:create': '创建 API Key',
  'apikeys:update': '更新 API Key',
  'apikeys:delete': '删除 API Key',

  // Webhook 权限
  'webhooks:read': '查看 Webhook',
  'webhooks:create': '创建 Webhook',
  'webhooks:update': '更新 Webhook',
  'webhooks:delete': '删除 Webhook',
  'webhooks:test': '测试 Webhook',

  // 统计权限
  'stats:read': '查看统计信息',
  'stats:export': '导出统计数据',

  // 系统权限
  'system:health': '查看系统健康状态',
  'system:info': '查看系统信息',
  'system:config': '修改系统配置',

  // 管理权限
  'admin:full': '完全管理权限'
};

// 权限组定义
export const PERMISSION_GROUPS = {
  'read': [
    'files:read',
    'files:list',
    'files:download',
    'system:health',
    'system:info'
  ],
  'write': [
    'files:upload',
    'files:update'
  ],
  'delete': [
    'files:delete'
  ],
  'admin': [
    'apikeys:read',
    'apikeys:create',
    'apikeys:update',
    'apikeys:delete',
    'webhooks:read',
    'webhooks:create',
    'webhooks:update',
    'webhooks:delete',
    'webhooks:test',
    'stats:read',
    'stats:export',
    'system:config',
    'admin:full'
  ]
};

// 角色定义
export const ROLES = {
  'viewer': {
    name: '查看者',
    description: '只能查看文件和基本信息',
    permissions: ['read']
  },
  'uploader': {
    name: '上传者',
    description: '可以上传和管理自己的文件',
    permissions: ['read', 'write']
  },
  'moderator': {
    name: '管理员',
    description: '可以管理所有文件',
    permissions: ['read', 'write', 'delete']
  },
  'admin': {
    name: '超级管理员',
    description: '拥有所有权限',
    permissions: ['read', 'write', 'delete', 'admin']
  }
};

// 权限展开缓存（使用 Map 存储，避免重复计算）
const permissionCache = new Map();
const CACHE_TTL = 60000; // 缓存 60 秒

// 展开权限组为具体权限（带缓存）
export function expandPermissions(permissionGroups) {
  if (!permissionGroups || !Array.isArray(permissionGroups)) {
    return [];
  }

  // 生成缓存键
  const cacheKey = permissionGroups.sort().join(',');
  const now = Date.now();

  // 检查缓存
  const cached = permissionCache.get(cacheKey);
  if (cached && (now - cached.timestamp < CACHE_TTL)) {
    return cached.permissions;
  }

  // 计算权限
  const expandedPermissions = new Set();

  for (const group of permissionGroups) {
    if (PERMISSION_GROUPS[group]) {
      PERMISSION_GROUPS[group].forEach(permission => {
        expandedPermissions.add(permission);
      });
    } else {
      // 如果不是权限组，可能是具体权限
      expandedPermissions.add(group);
    }
  }

  const result = Array.from(expandedPermissions);

  // 存入缓存
  permissionCache.set(cacheKey, {
    permissions: result,
    timestamp: now
  });

  // 清理过期缓存（防止内存泄漏）
  if (permissionCache.size > 100) {
    for (const [key, value] of permissionCache) {
      if (now - value.timestamp > CACHE_TTL) {
        permissionCache.delete(key);
      }
    }
  }

  return result;
}

// 检查用户是否有特定权限（支持层级权限）
export function hasPermission(user, requiredPermission) {
  if (!user || !user.permissions) {
    return false;
  }

  // 展开用户的权限组
  const userPermissions = expandPermissions(user.permissions);

  // 管理员权限可以访问所有资源
  // 支持 'admin'、'admin:full'、'admin:*' 等格式
  const isAdmin = user.permissions.some(p =>
    p === 'admin' ||
    p.startsWith('admin:') ||
    p === '*'
  ) || userPermissions.includes('admin:full');

  if (isAdmin) {
    return true;
  }

  // 检查具体权限
  return userPermissions.includes(requiredPermission);
}

// 检查用户是否有多个权限中的任意一个
export function hasAnyPermission(user, requiredPermissions) {
  return requiredPermissions.some(permission => hasPermission(user, permission));
}

// 检查用户是否有所有指定权限
export function hasAllPermissions(user, requiredPermissions) {
  return requiredPermissions.every(permission => hasPermission(user, permission));
}

// 获取用户的所有权限
export function getUserPermissions(user) {
  if (!user || !user.permissions) {
    return [];
  }

  return expandPermissions(user.permissions);
}

// 权限中间件工厂
export function requirePermission(permission) {
  return function (context) {
    const user = context.data?.user || context.user;
    if (!hasPermission(user, permission)) {
      const error = new Error(`Permission '${permission}' required`);
      error.name = 'AuthorizationError';
      error.code = 'INSUFFICIENT_PERMISSIONS';
      error.requiredPermission = permission;
      error.userPermissions = getUserPermissions(user);
      throw error;
    }
  };
}

// 多权限中间件工厂（需要任意一个权限）
export function requireAnyPermission(permissions) {
  return function (context) {
    const user = context.data?.user || context.user;
    if (!hasAnyPermission(user, permissions)) {
      const error = new Error(`One of these permissions required: ${permissions.join(', ')}`);
      error.name = 'AuthorizationError';
      error.code = 'INSUFFICIENT_PERMISSIONS';
      error.requiredPermissions = permissions;
      error.userPermissions = getUserPermissions(user);
      throw error;
    }
  };
}

// 多权限中间件工厂（需要所有权限）
export function requireAllPermissions(permissions) {
  return function (context) {
    const user = context.data?.user || context.user;
    if (!hasAllPermissions(user, permissions)) {
      const error = new Error(`All of these permissions required: ${permissions.join(', ')}`);
      error.name = 'AuthorizationError';
      error.code = 'INSUFFICIENT_PERMISSIONS';
      error.requiredPermissions = permissions;
      error.userPermissions = getUserPermissions(user);
      throw error;
    }
  };
}

// 验证权限配置
export function validatePermissions(permissions) {
  const errors = [];

  for (const permission of permissions) {
    // 检查是否是有效的权限组
    if (PERMISSION_GROUPS[permission]) {
      continue;
    }

    // 检查是否是有效的具体权限
    if (PERMISSIONS[permission]) {
      continue;
    }

    errors.push(`Invalid permission: ${permission}`);
  }

  return errors;
}

// 获取角色的权限
export function getRolePermissions(roleName) {
  const role = ROLES[roleName];
  if (!role) {
    throw new Error(`Invalid role: ${roleName}`);
  }

  return expandPermissions(role.permissions);
}

// 权限审计日志
export function logPermissionCheck(user, permission, granted, context = {}) {
  const logEntry = {
    timestamp: new Date().toISOString(),
    user: {
      id: user?.id,
      name: user?.name,
      type: user?.type
    },
    permission: permission,
    granted: granted,
    context: context
  };

  console.log('Permission Check:', JSON.stringify(logEntry));

  return logEntry;
}

// 权限报告生成器
export function generatePermissionReport(user) {
  const userPermissions = getUserPermissions(user);
  const report = {
    user: {
      id: user?.id,
      name: user?.name,
      type: user?.type,
      permissionGroups: user?.permissions || []
    },
    expandedPermissions: userPermissions,
    capabilities: {
      canReadFiles: hasPermission(user, 'files:read'),
      canUploadFiles: hasPermission(user, 'files:upload'),
      canDeleteFiles: hasPermission(user, 'files:delete'),
      canManageApiKeys: hasPermission(user, 'apikeys:create'),
      canManageWebhooks: hasPermission(user, 'webhooks:create'),
      isAdmin: hasPermission(user, 'admin:full')
    },
    generatedAt: new Date().toISOString()
  };

  return report;
}
