import { generatePrefixedId } from '../_shared/utils.js';
import { parseJsonArray } from '../api/utils/json.js';
import { buildSetClause } from '../api/utils/sql.js';

/**
 * 计算字符串的 SHA-256 哈希（hex 编码）
 * @param {string} secret
 * @returns {Promise<string>}
 */
export async function hashSecret(secret) {
  const data = new TextEncoder().encode(secret);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
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
    return (results || []).map(row => this._rowToClient(row));
  }

  async getClientById(id) {
    const row = await this.db.prepare('SELECT * FROM oauth_clients WHERE id = ?').bind(id).first();
    return row ? this._rowToClient(row) : null;
  }

  async getClientByClientId(clientId) {
    const row = await this.db.prepare('SELECT * FROM oauth_clients WHERE client_id = ?').bind(clientId).first();
    return row ? this._rowToClient(row, { includeSecret: true }) : null;
  }

  async createClient({ name, description, redirectUris = [], grantTypes = ['authorization_code'], scopes = ['read'], actorId = null }) {
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
        id, clientId, hashedSecret, name, description || null,
        JSON.stringify(redirectUris), JSON.stringify(grantTypes), JSON.stringify(scopes),
        actorId, timestamp, timestamp
      )
      .run();
    return { id, clientId, clientSecret, name, description, redirectUris, grantTypes, scopes };
  }

  async updateClient(id, { name, description, redirectUris, grantTypes, scopes, enabled, actorId: _actorId }) {
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
    const row = await this.db
      .prepare('SELECT * FROM oauth_authorization_codes WHERE code = ? AND used = 0')
      .bind(code)
      .first();
    if (!row) return null;
    if (row.expires_at < this.now()) return null;
    await this.db
      .prepare('UPDATE oauth_authorization_codes SET used = 1 WHERE id = ?')
      .bind(row.id)
      .run();
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

  async createToken({ clientId, userId, scopes, accessToken, refreshToken, expiresInMs = 3600000, refreshExpiresInMs = 86400000 }) {
    const id = this.tokenIdFactory();
    const timestamp = this.now();
    const expiresAt = timestamp + expiresInMs;
    const refreshExpiresAt = refreshToken ? timestamp + refreshExpiresInMs : null;
    await this.db
      .prepare(
        `INSERT INTO oauth_tokens (id, access_token, refresh_token, client_id, user_id, scopes, expires_at, refresh_expires_at, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(id, accessToken, refreshToken || null, clientId, userId, JSON.stringify(scopes), expiresAt, refreshExpiresAt, timestamp)
      .run();
    return { accessToken, refreshToken, expiresAt, scopes };
  }

  async getTokenByAccessToken(accessToken) {
    const row = await this.db
      .prepare('SELECT * FROM oauth_tokens WHERE access_token = ? AND revoked = 0')
      .bind(accessToken)
      .first();
    if (!row) return null;
    if (row.expires_at < this.now()) return null;
    return this._rowToToken(row);
  }

  async getTokenByRefreshToken(refreshToken) {
    const row = await this.db
      .prepare('SELECT * FROM oauth_tokens WHERE refresh_token = ? AND revoked = 0')
      .bind(refreshToken)
      .first();
    if (!row) return null;
    if (row.refresh_expires_at && row.refresh_expires_at < this.now()) return null;
    return this._rowToToken(row);
  }

  async revokeToken(accessToken) {
    await this.db
      .prepare('UPDATE oauth_tokens SET revoked = 1 WHERE access_token = ?')
      .bind(accessToken)
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
      .prepare('SELECT * FROM oauth_tokens WHERE client_id = ? AND revoked = 0 ORDER BY created_at DESC')
      .bind(clientId)
      .all();
    return (results || []).map(row => this._rowToToken(row));
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
