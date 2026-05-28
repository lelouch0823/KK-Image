/**
 * Cron 鉴权辅助
 * 约定：Authorization: Bearer <CRON_SECRET>
 */
function timingSafeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

export function isCronAuthorized(request, env = {}) {
  const authHeader = request.headers.get('Authorization');
  const secret = String(env.CRON_SECRET || '').trim();
  if (!secret) return false;
  return Boolean(authHeader) && timingSafeEqual(authHeader, `Bearer ${secret}`);
}
