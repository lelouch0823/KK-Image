import { getPolicyMetadata } from '../../lib/authz/index.js';

const metadata = getPolicyMetadata();
const roleEntries = Object.entries(metadata.roles || {});
const actionList = Array.isArray(metadata.actions) ? metadata.actions : [];
const actionLabels = metadata.actionLabels || {};

export const ROLES = Object.freeze(
  Object.fromEntries(roleEntries.map(([role]) => [role.toUpperCase(), role]))
);

export const PERMISSIONS = Object.freeze(
  Object.fromEntries(actionList.map((action) => [action, actionLabels[action] || action]))
);

const rolePermissionMap = Object.fromEntries(
  roleEntries.map(([role, def]) => [role, new Set(Array.isArray(def?.permissions) ? def.permissions : [])])
);

export function hasPermission(userRole, requiredPermission) {
  if (!userRole || !requiredPermission) return false;

  const normalizedRole = String(userRole).toLowerCase();
  if (normalizedRole === ROLES.ADMIN) return true;

  const perms = rolePermissionMap[normalizedRole];
  return Boolean(perms?.has(requiredPermission));
}

