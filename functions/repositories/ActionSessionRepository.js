/**
 * AI 动作会话仓库 (Action Session Repository)
 * =============================================
 *
 * 封装 ai_action_sessions 表的 CRUD 操作。
 */

function normalizeJson(value, fallback = {}) {
  if (value === undefined) return JSON.stringify(fallback);
  return JSON.stringify(value);
}

function toSessionRecord(payload = {}) {
  const now = Date.now();
  const expiresAt = Number(payload.expiresAt) || now + 30 * 60 * 1000;

  return {
    id: payload.id,
    user_id: payload.userId,
    action_type: payload.actionType,
    entity_type: payload.entityType,
    status: payload.status || 'collecting',
    slots_json: normalizeJson(payload.slots, {}),
    preview_json: payload.preview === undefined ? null : normalizeJson(payload.preview, {}),
    expires_at: expiresAt,
    created_at: now,
    updated_at: now,
  };
}

export class ActionSessionRepository {
  constructor(db) {
    this.db = db;
  }

  async createSession(payload = {}) {
    const record = toSessionRecord(payload);

    await this.db
      .prepare(
        `
      INSERT INTO ai_action_sessions (
        id, user_id, action_type, entity_type, status, slots_json, preview_json, expires_at, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `
      )
      .bind(
        record.id,
        record.user_id,
        record.action_type,
        record.entity_type,
        record.status,
        record.slots_json,
        record.preview_json,
        record.expires_at,
        record.created_at,
        record.updated_at
      )
      .run();

    return record;
  }

  async getLatestActiveSession(userId) {
    return this.db
      .prepare(
        `
      SELECT *
      FROM ai_action_sessions
      WHERE user_id = ?
        AND status NOT IN ('completed', 'cancelled')
        AND expires_at > ?
      ORDER BY updated_at DESC
      LIMIT 1
    `
      )
      .bind(userId, Date.now())
      .first();
  }

  async updateSession(id, patch = {}) {
    const updatedAt = Date.now();
    const nextStatus = patch.status || 'collecting';
    const replaceSlots = patch.slots !== undefined ? 1 : 0;
    const slotsJson = replaceSlots ? normalizeJson(patch.slots, {}) : null;
    const replacePreview = patch.preview !== undefined ? 1 : 0;
    const previewJson = replacePreview
      ? patch.preview === null
        ? null
        : normalizeJson(patch.preview, {})
      : null;

    await this.db
      .prepare(
        `
      UPDATE ai_action_sessions
      SET status = ?,
          slots_json = CASE WHEN ? = 1 THEN ? ELSE slots_json END,
          preview_json = CASE WHEN ? = 1 THEN ? ELSE preview_json END,
          updated_at = ?
      WHERE id = ?
    `
      )
      .bind(nextStatus, replaceSlots, slotsJson, replacePreview, previewJson, updatedAt, id)
      .run();

    return {
      id,
      status: nextStatus,
      slots_json: slotsJson,
      preview_json: previewJson,
      updated_at: updatedAt,
    };
  }
}
