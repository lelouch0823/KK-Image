/**
 * Cron 鉴权辅助
 * 约定：Authorization: Bearer <CRON_SECRET>
 */
export function isCronAuthorized(request, env = {}) {
  const authHeader = request.headers.get('Authorization');
  const secret = env.CRON_SECRET || 'dev-secret';
  return Boolean(authHeader) && authHeader === `Bearer ${secret}`;
}
