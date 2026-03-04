/**
 * Normalize auth context so response payloads and authz input stay consistent.
 */
export function normalizeUserContext(user) {
  const roleValue = typeof user?.role === 'string' ? user.role.trim() : '';
  const role = roleValue || (user?.type === 'admin' ? 'admin' : null);
  const permissions = Array.isArray(user?.permissions) ? user.permissions : [];

  return {
    ...user,
    role,
    permissions,
    type: user?.type ?? null,
  };
}

/**
 * Legacy JWTs from early versions may miss both role and permissions.
 * Treat them as invalid so client re-authenticates and gets a fresh token context.
 */
export function isLegacyJwtContext(user) {
  const normalized = normalizeUserContext(user);
  return normalized.type === 'jwt' && normalized.role === null && normalized.permissions.length === 0;
}
