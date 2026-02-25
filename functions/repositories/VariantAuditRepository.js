import { generateId, now } from '../api/utils/id.js';

export class VariantAuditRepository {
  constructor(db) {
    this.db = db;
  }

  async createBatch(events = [], actor = { actor_type: 'system', actor_id: null }) {
    if (!Array.isArray(events) || events.length === 0) return [];

    const timestamp = now();
    const statements = events.map((event) =>
      this.db.prepare(
        `INSERT INTO variant_audit_logs
          (id, variant_id, product_id, actor_type, actor_id, action, changes_json, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(
        generateId(),
        event.variant_id,
        event.product_id,
        actor.actor_type || 'system',
        actor.actor_id || null,
        event.action,
        JSON.stringify(event.changes || {}),
        timestamp
      )
    );

    await this.db.batch(statements);
    return events;
  }
}
