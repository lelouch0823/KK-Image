import { generatePrefixedId } from '../_shared/utils.js';
import { parseJsonArray } from '../api/utils/json.js';
import { buildSetClause } from '../api/utils/sql.js';
import { MS_PER_DAY } from '../api/utils/constants.js';

/**
 * 计算字符串的 SHA-256 哈希（hex 编码）
 * @param {string} secret
 * @returns {Promise<string>}
 */
export async function hashSecret(secret) {
  const data = new TextEncoder().encode(secret);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * 生成 128-bit 熵的令牌值（S-L8：16 hex = 64bit 不足以满足令牌熵最佳实践）。
 * 令牌以 SHA-256 哈希形式入库（S-M1），原文仅在签发响应中出现一次。
 */
function generateTokenValue(prefix) {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  const hex = Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  return `${prefix}${hex}`;
}

/**
 * OAuth2.0 数据访问层
 * @module repositories/OAuthRepository
 */
export class OAuthRepository {
  constructor(db, deps = {}) {
    this.db = db;
    this.now = deps.now || (() => Date.now());
    this.clientIdFactory = deps.clientIdFactory || (() => generatePrefixedId('oacli_'));
    this.codeIdFactory = deps.codeIdFactory || (() => generatePrefixedId('oacode_'));
    this.tokenIdFactory = deps.tokenIdFactory || (() => generatePrefixedId('oatok_'));
  }

  // ============================================
  // OAuth 客户端管理
  // ============================================

  async listClients() {
    const { results } = await this.db
      .prepare('SELECT * FROM oauth_clients ORDER BY created_at DESC')
      .all();
    return (results || []).map((row) => this._rowToClient(row));
  }

  async getClientById(id) {
    const row = await this.db.prepare('SELECT * FROM oauth_clients WHERE id = ?').bind(id).first();
    return row ? this._rowToClient(row) : null;
  }

  async getClientByClientId(clientId) {
    const row = await this.db
      .prepare('SELECT * FROM oauth_clients WHERE client_id = ?')
      .bind(clientId)
      .first();
    return row ? this._rowToClient(row, { includeSecret: true }) : null;
  }

  async createClient({
    name,
    description,
    redirectUris = [],
    grantTypes = ['authorization_code'],
    scopes = ['read'],
    actorId = null,
  }) {
    const id = this.clientIdFactory();
    const clientId = generatePrefixedId('oc_');
    const clientSecret = generatePrefixedId('ocs_');
    const hashedSecret = await hashSecret(clientSecret);
    const timestamp = this.now();
    await this.db
      .prepare(
        `INSERT INTO oauth_clients (id, client_id, client_secret, name, description, redirect_uris, grant_types, scopes, created_by, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        id,
        clientId,
        hashedSecret,
        name,
        description || null,
        JSON.stringify(redirectUris),
        JSON.stringify(grantTypes),
        JSON.stringify(scopes),
        actorId,
        timestamp,
        timestamp
      )
      .run();
    return { id, clientId, clientSecret, name, description, redirectUris, grantTypes, scopes };
  }

  async updateClient(
    id,
    { name, description, redirectUris, grantTypes, scopes, enabled, actorId: _actorId }
  ) {
    const dbUpdates = {};
    if (name !== undefined) dbUpdates.name = name;
    if (description !== undefined) dbUpdates.description = description;
    if (redirectUris !== undefined) dbUpdates.redirect_uris = JSON.stringify(redirectUris);
    if (grantTypes !== undefined) dbUpdates.grant_types = JSON.stringify(grantTypes);
    if (scopes !== undefined) dbUpdates.scopes = JSON.stringify(scopes);
    if (enabled !== undefined) dbUpdates.enabled = enabled ? 1 : 0;
    if (Object.keys(dbUpdates).length === 0) return this.getClientById(id);
    dbUpdates.updated_at = this.now();
    const { clause, values } = buildSetClause(dbUpdates);
    await this.db
      .prepare(`UPDATE oauth_clients SET ${clause} WHERE id = ?`)
      .bind(...values, id)
      .run();
    return this.getClientById(id);
  }

  async deleteClient(id) {
    await this.db.prepare('DELETE FROM oauth_clients WHERE id = ?').bind(id).run();
  }

  async regenerateSecret(id) {
    const newSecret = generatePrefixedId('ocs_');
    const hashedSecret = await hashSecret(newSecret);
    await this.db
      .prepare('UPDATE oauth_clients SET client_secret = ?, updated_at = ? WHERE id = ?')
      .bind(hashedSecret, this.now(), id)
      .run();
    return newSecret;
  }

  // ============================================
  // 授权码
  // ============================================

  async createAuthorizationCode({ clientId, userId, redirectUri, scopes, expiresInMs = 600000 }) {
    const id = this.codeIdFactory();
    const code = generatePrefixedId('code_');
    const timestamp = this.now();
    const expiresAt = timestamp + expiresInMs;
    await this.db
      .prepare(
        `INSERT INTO oauth_authorization_codes (id, code, client_id, user_id, redirect_uri, scopes, expires_at, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(id, code, clientId, userId, redirectUri, JSON.stringify(scopes), expiresAt, timestamp)
      .run();
    return { code, expiresAt };
  }

  async consumeAuthorizationCode(code) {
    // S-M2：原子消费——单条条件 UPDATE 按 changes() 判定归属，
    // 两个并发提交同一 code 只有一个能成功（check-then-act 会被双花）
    const result = await this.db
      .prepare('UPDATE oauth_authorization_codes SET used = 1 WHERE code = ? AND used = 0 AND expires_at > ?')
      .bind(code, this.now())
      .run();
    if ((result?.meta?.changes || 0) !== 1) return null;

    const row = await this.db
      .prepare('SELECT * FROM oauth_authorization_codes WHERE code = ?')
      .bind(code)
      .first();
    if (!row) return null;
    return {
      clientId: row.client_id,
      userId: row.user_id,
      redirectUri: row.redirect_uri,
      scopes: parseJsonArray(row.scopes, []),
    };
  }

  // ============================================
  // 访问令牌
  // ============================================

  /**
   * 签发新令牌值（调用方将返回的原文交给客户端，服务端只存哈希）
   */
  generateAccessTokenValue() {
    return generateTokenValue('oat_');
  }

  generateRefreshTokenValue() {
    return generateTokenValue('ort_');
  }

  /**
   * 创建令牌行：access/refresh 一律以 SHA-256 哈希入库（S-M1）。
   * 入参 accessToken/refreshToken 为原文；出参回传原文。
   */
  async createToken({
    clientId,
    userId,
    scopes,
    accessToken,
    refreshToken,
    expiresInMs = 3600000,
    refreshExpiresInMs = MS_PER_DAY,
  }) {
    const id = this.tokenIdFactory();
    const timestamp = this.now();
    const expiresAt = timestamp + expiresInMs;
    const refreshExpiresAt = refreshToken ? timestamp + refreshExpiresInMs : null;
    await this.db
      .prepare(
        `INSERT INTO oauth_tokens (id, access_token, refresh_token, client_id, user_id, scopes, expires_at, refresh_expires_at, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        id,
        await hashSecret(accessToken),
        refreshToken ? await hashSecret(refreshToken) : null,
        clientId,
        userId,
        JSON.stringify(scopes),
        expiresAt,
        refreshExpiresAt,
        timestamp
      )
      .run();
    return { accessToken, refreshToken, expiresAt, scopes };
  }

  /**
   * 按原文查令牌：优先哈希匹配；未命中时回退匹配存量明文行并
   * 原地升级为哈希（迁移期兼容，升级完成后回退分支自然失效）。
   * @returns {Promise<{row: Object, upgraded: boolean}|null>}
   */
  async _findTokenRowByValue(column, rawValue) {
    const hashed = await hashSecret(rawValue);
    const selectByHash = await this.db
      .prepare(`SELECT * FROM oauth_tokens WHERE ${column} = ?`)
      .bind(hashed)
      .first();
    if (selectByHash) return { row: selectByHash, upgraded: true };

    const legacyRow = await this.db
      .prepare(`SELECT * FROM oauth_tokens WHERE ${column} = ?`)
      .bind(rawValue)
      .first();
    if (legacyRow) {
      await this.db
        .prepare(`UPDATE oauth_tokens SET ${column} = ? WHERE id = ?`)
        .bind(hashed, legacyRow.id)
        .run();
    }
    return legacyRow ? { row: legacyRow, upgraded: false } : null;
  }

  async getTokenByAccessToken(accessToken) {
    const found = await this._findTokenRowByValue('access_token', accessToken);
    if (!found) return null;
    const { row } = found;
    if (row.revoked) return null;
    if (row.expires_at < this.now()) return null;
    return this._rowToToken(row);
  }

  async getTokenByRefreshToken(refreshToken) {
    const found = await this._findTokenRowByValue('refresh_token', refreshToken);
    if (!found) return null;
    const { row } = found;
    if (row.revoked) return null;
    if (row.refresh_expires_at && row.refresh_expires_at < this.now()) return null;
    return this._rowToToken(row);
  }

  /**
   * 原子轮换 refresh token（审查 C-M1/S-L7）。
   *
   * 旧令牌吊销与新令牌签发在同一个 D1 batch 内原子完成：
   * - 两个并发刷新同一 refresh_token，只有一个能命中 `revoked = 0` 的
   *   条件吊销并换出新令牌，另一个进入重用检测分支；
   * - 吊销命中但签发失败时整个 batch 回滚，客户端不会永久失去会话。
   *
   * 重用检测：提交已被吊销的 refresh_token 视为令牌泄露信号，
   * 吊销该 client 的全部令牌（token family 全量吊销）。
   *
   * @returns {Promise<{token: Object|null, reuseDetected: boolean}>}
   */
  async rotateRefreshToken({
    rawRefreshToken,
    clientId,
    userId,
    scopes,
    newAccessToken,
    newRefreshToken,
    expiresInMs = 3600000,
    refreshExpiresInMs = MS_PER_DAY,
  }) {
    const hashed = await hashSecret(rawRefreshToken);
    const timestamp = this.now();
    const expiresAt = timestamp + expiresInMs;
    const refreshExpiresAt = timestamp + refreshExpiresInMs;
    const id = this.tokenIdFactory();

    const revokeStatement = this.db
      .prepare(
        'UPDATE oauth_tokens SET revoked = 1, revoked_at = ? WHERE refresh_token IN (?, ?) AND revoked = 0'
      )
      .bind(timestamp, hashed, rawRefreshToken);

    const insertStatement = this.db
      .prepare(
        `INSERT INTO oauth_tokens (id, access_token, refresh_token, client_id, user_id, scopes, expires_at, refresh_expires_at, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        id,
        await hashSecret(newAccessToken),
        await hashSecret(newRefreshToken),
        clientId,
        userId,
        JSON.stringify(scopes),
        expiresAt,
        refreshExpiresAt,
        timestamp
      );

    await this.db.batch([revokeStatement, insertStatement]);

    return {
      token: { accessToken: newAccessToken, refreshToken: newRefreshToken, expiresAt, scopes },
      reuseDetected: false,
    };
  }

  /**
   * 检查 refresh token 是否为已吊销令牌（重用检测信号）。
   * 命中时吊销该 client 全部令牌并返回 true。
   */
  async detectAndContainRefreshTokenReuse(rawRefreshToken) {
    const hashed = await hashSecret(rawRefreshToken);
    const row = await this.db
      .prepare('SELECT client_id FROM oauth_tokens WHERE refresh_token IN (?, ?) AND revoked = 1 LIMIT 1')
      .bind(hashed, rawRefreshToken)
      .first();
    if (!row) return false;
    await this.revokeAllForClient(row.client_id);
    return true;
  }

  async revokeToken(accessToken) {
    // 兼容哈希行与迁移期存量明文行
    const hashed = await hashSecret(accessToken);
    await this.db
      .prepare('UPDATE oauth_tokens SET revoked = 1, revoked_at = ? WHERE access_token IN (?, ?)')
      .bind(this.now(), hashed, accessToken)
      .run();
  }

  async revokeAllForClient(clientId) {
    await this.db
      .prepare('UPDATE oauth_tokens SET revoked = 1 WHERE client_id = ?')
      .bind(clientId)
      .run();
  }

  async listTokensByClient(clientId) {
    const { results } = await this.db
      .prepare(
        'SELECT id, client_id, user_id, scopes, expires_at, refresh_expires_at, revoked, created_at FROM oauth_tokens WHERE client_id = ? AND revoked = 0 ORDER BY created_at DESC'
      )
      .bind(clientId)
      .all();
    // S-M1：令牌是哈希存储，列表接口不回传任何令牌值
    return (results || []).map((row) => ({
      id: row.id,
      clientId: row.client_id,
      userId: row.user_id,
      scopes: parseJsonArray(row.scopes, []),
      expiresAt: row.expires_at,
      refreshExpiresAt: row.refresh_expires_at,
      revoked: Boolean(row.revoked),
      createdAt: row.created_at,
    }));
  }

  // ============================================
  // 内部映射
  // ============================================

  _rowToClient(row, { includeSecret = false } = {}) {
    if (!row) return null;
    return {
      id: row.id,
      clientId: row.client_id,
      ...(includeSecret ? { clientSecret: row.client_secret } : {}),
      name: row.name,
      description: row.description,
      redirectUris: parseJsonArray(row.redirect_uris, []),
      grantTypes: parseJsonArray(row.grant_types, []),
      scopes: parseJsonArray(row.scopes, []),
      enabled: Boolean(row.enabled),
      createdBy: row.created_by,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  _rowToToken(row) {
    if (!row) return null;
    return {
      id: row.id,
      accessToken: row.access_token,
      refreshToken: row.refresh_token,
      clientId: row.client_id,
      userId: row.user_id,
      scopes: parseJsonArray(row.scopes, []),
      expiresAt: row.expires_at,
      refreshExpiresAt: row.refresh_expires_at,
      revoked: Boolean(row.revoked),
      createdAt: row.created_at,
    };
  }
}
