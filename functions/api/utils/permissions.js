export const ROLES = {
    ADMIN: 'admin',
    MANAGER: 'manager',
    SALES: 'sales',
    VIEWER: 'viewer',
    USER: 'user' // Legacy alias for viewer
};

// Map each role to a set of allowed permissions
export const PERMISSIONS = {
    [ROLES.ADMIN]: ['*'], // Admin has all permissions
    [ROLES.MANAGER]: [
        'read', 'write', 'delete', 'share',
        'files:read', 'files:write', 'files:delete',
        'folders:read', 'folders:write', 'folders:delete',
        'settings:read',
        'spaces:manage',
        'products:manage',
        'orders:manage',
        'users:read',
        'stats:read'
    ],
    [ROLES.SALES]: [
        'read', 'write',
        'files:read', 'files:write',
        'spaces:read', 'spaces:manage',
        'orders:manage',
        'products:read',
        'users:read'
    ],
    [ROLES.VIEWER]: [
        'read',
        'files:read',
        'spaces:read',
        'products:read',
        'users:read',
        'stats:read'
    ],
    [ROLES.USER]: [
        'read',
        'files:read',
        'spaces:read',
        'products:read'
    ]
};

/**
 * Check if a specific role contains the required permission
 * @param {string} userRole - Example: 'admin' or 'sales'
 * @param {string} requiredPermission - Required action like 'write' or 'files:read'
 * @returns {boolean}
 */
export function hasPermission(userRole, requiredPermission) {
    if (!userRole || !PERMISSIONS[userRole]) return false;

    const perms = PERMISSIONS[userRole];

    // Wildcard grants all permissions
    if (perms.includes('*')) return true;

    // Explicit permission
    if (perms.includes(requiredPermission)) return true;

    // Check module-level wildcards (e.g. if requested 'files:write' and user has 'files:*')
    // and if required is 'read', 'write' etc., and user has 'read'
    return false;
}
