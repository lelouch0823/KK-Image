/**
 * Cron 鉴权辅助
 * 约定：Authorization: Bearer <CRON_SECRET>
 */
export function isCronAuthorized(request, env = {}) {
  const authHeader = request.headers.get('Authorization');
  const secret = String(env.CRON_SECRET || '').trim();
  if (!secret) return false;
  return Boolean(authHeader) && authHeader === `Bearer ${secret}`;
}
