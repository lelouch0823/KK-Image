/**
 * 生产环境密钥护栏（审查 S-H1）
 * ============================================
 *
 * 仓库中提交的默认密钥（wrangler.toml [vars] / dev 脚本绑定）一旦被带到
 * 生产环境，攻击者可用公开值自签管理员 JWT 完全接管系统，且默认值同时
 * 充当密码 pepper，可离线爆破用户口令。
 *
 * 本模块在生产环境（ENVIRONMENT=production）对已知默认值/弱长度实行
 * fail-closed：签发与校验令牌前拒绝执行。
 */

/** 已提交到仓库的默认密钥清单（保持与 wrangler.toml、package.json dev 脚本同步） */
const KNOWN_DEFAULT_SECRETS = new Set([
  'dev-only-password',
  'dev-only-jwt-secret-change-in-production',
  'dev-secret-key-123',
  'dev-secret',
  '123',
]);

/** 生产环境判定（兼容 NODE_ENV 命名） */
export function isProductionEnv(env = {}) {
  return String(env.ENVIRONMENT || env.NODE_ENV || '')
    .trim()
    .toLowerCase() === 'production';
}

/**
 * 判断密钥是否为不安全值（已知默认值或长度不足）。
 * 非 production 环境始终返回 false（本地开发允许默认值）。
 */
export function isUnsafeSecret(env, value, { minLength = 24 } = {}) {
  if (!isProductionEnv(env)) return false;
  const normalized = String(value ?? '').trim();
  if (!normalized) return true;
  if (normalized.length < minLength) return true;
  return KNOWN_DEFAULT_SECRETS.has(normalized);
}

/**
 * 生产环境 fail-closed 校验：密钥缺失/默认/弱长度时抛错。
 * JWT 签发与校验路径调用，保证默认密钥无法在生产签出有效令牌。
 */
export function assertProductionSecret(env, name, value, options = {}) {
  if (!isProductionEnv(env)) return;
  if (isUnsafeSecret(env, value, options)) {
    throw new Error(
      `[Security] ${name} 未正确配置（缺失、使用仓库默认值或强度不足）。` +
        '生产环境必须通过 Cloudflare Dashboard 或 `wrangler pages secret put` 设置高熵密钥。'
    );
  }
}
