import { parseJsonObject } from '../api/utils/json.js';

export class SystemStatsProjectionRepository {
  constructor(db, deps = {}) {
    this.db = db;
    this.now = deps.now || (() => Date.now());
  }

  async get(scope) {
    const row = await this.db
      .prepare(
        'SELECT scope, payload_json, updated_at FROM system_stats_projection WHERE scope = ?'
      )
      .bind(scope)
      .first();

    if (!row) return null;

    return {
      scope: row.scope,
      updatedAt: row.updated_at,
      payload: parseJsonObject(row.payload_json, {}),
    };
  }

  async upsert(scope, payload, updatedAt = this.now()) {
    await this.db
      .prepare(
        `
        INSERT INTO system_stats_projection (scope, payload_json, updated_at)
        VALUES (?, ?, ?)
        ON CONFLICT(scope) DO UPDATE SET
          payload_json = excluded.payload_json,
          updated_at = excluded.updated_at
      `
      )
      .bind(scope, JSON.stringify(payload || {}), updatedAt)
      .run();

    return this.get(scope);
  }
}
