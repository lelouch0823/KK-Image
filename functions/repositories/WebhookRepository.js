import { parseJsonArray, parseJsonObject } from '../api/utils/json.js';
import { generatePrefixedId } from '../_shared/utils.js';
import { inClause } from '../api/utils/sql.js';

function rowToWebhook(row, { includeSecret = false } = {}) {
  if (!row) return null;

  return {
    id: row.id,
    url: row.url,
    events: parseJsonArray(row.events, []),
    ...(includeSecret ? { secret: row.secret || null } : {}),
    hasSecret: Boolean(row.secret),
    headers: parseJsonObject(row.headers, {}),
    enabled: Boolean(row.enabled),
    createdBy: row.created_by || null,
    createdAt: row.created_at || null,
    updatedBy: row.updated_by || null,
    updatedAt: row.updated_at || null,
  };
}

export class WebhookRepository {
  constructor(db, deps = {}) {
    this.db = db;
    this.now = deps.now || (() => Date.now());
    this.idFactory = deps.idFactory || (() => generatePrefixedId('wh_'));
    this.logIdFactory = deps.logIdFactory || (() => generatePrefixedId('whlog_'));
  }

  async listActiveByEvent(eventType) {
    const { results } = await this.db
      .prepare(
        `SELECT w.*
         FROM webhook_event_subscriptions wes
         JOIN webhooks w ON w.id = wes.webhook_id
         WHERE wes.event_type = ?
           AND w.enabled = 1
         ORDER BY w.created_at DESC`
      )
      .bind(eventType)
      .all();

    return (results || []).map((row) => rowToWebhook(row, { includeSecret: true }));
  }

  async listAll() {
    const { results } = await this.db
      .prepare('SELECT * FROM webhooks ORDER BY created_at DESC')
      .all();

    return (results || []).map((row) => rowToWebhook(row));
  }

  async getById(id) {
    const row = await this.db.prepare('SELECT * FROM webhooks WHERE id = ?').bind(id).first();

    return rowToWebhook(row);
  }

  async getByIdWithSecret(id) {
    const row = await this.db.prepare('SELECT * FROM webhooks WHERE id = ?').bind(id).first();
    return rowToWebhook(row, { includeSecret: true });
  }

  async create({ url, events = [], secret = null, headers = {}, enabled = true, actorId = null }) {
    const id = this.idFactory();
    const timestamp = this.now();

    await this.db
      .prepare(
        `INSERT INTO webhooks (id, url, events, secret, headers, enabled, created_by, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        id,
        url,
        JSON.stringify(events || []),
        secret,
        JSON.stringify(headers || {}),
        enabled ? 1 : 0,
        actorId,
        timestamp
      )
      .run();

    return this.getById(id);
  }

  async update(id, { url, events, secret, headers, enabled, actorId = null }) {
    const timestamp = this.now();
    const current = await this.getByIdWithSecret(id);
    if (!current) return null;
    const next = {
      url: url ?? current?.url,
      events: events ?? current?.events ?? [],
      secret: secret !== undefined ? secret : current?.secret ?? null,
      headers: headers ?? current?.headers ?? {},
      enabled: enabled ?? current?.enabled ?? true,
    };

    await this.db
      .prepare(
        `UPDATE webhooks
         SET url = ?,
             events = ?,
             secret = ?,
             headers = ?,
             enabled = ?,
             updated_by = ?,
             updated_at = ?
         WHERE id = ?`
      )
      .bind(
        next.url,
        JSON.stringify(next.events || []),
        next.secret,
        JSON.stringify(next.headers || {}),
        next.enabled ? 1 : 0,
        actorId,
        timestamp,
        id
      )
      .run();

    return this.getById(id);
  }

  async delete(id) {
    await this.db.prepare('DELETE FROM webhooks WHERE id = ?').bind(id).run();

    return true;
  }

  async logAttempt(input) {
    const record = {
      id: this.logIdFactory(),
      webhook_id: input.webhookId,
      event: input.eventType,
      payload: input.payload == null ? null : JSON.stringify(input.payload),
      status_code: input.statusCode ?? null,
      response: input.response ?? null,
      duration_ms: input.durationMs ?? null,
      success: input.success ? 1 : 0,
      event_id: input.eventId ?? null,
      delivery_key: input.deliveryKey ?? null,
      attempt_number: input.attemptNumber ?? 1,
      classification: input.classification ?? null,
      next_retry_at: input.nextRetryAt ?? null,
      created_at: this.now(),
    };

    await this.db
      .prepare(
        `INSERT INTO webhook_logs (
          id,
          webhook_id,
          event,
          payload,
          status_code,
          response,
          duration_ms,
          success,
          event_id,
          delivery_key,
          attempt_number,
          classification,
          next_retry_at,
          created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        record.id,
        record.webhook_id,
        record.event,
        record.payload,
        record.status_code,
        record.response,
        record.duration_ms,
        record.success,
        record.event_id,
        record.delivery_key,
        record.attempt_number,
        record.classification,
        record.next_retry_at,
        record.created_at
      )
      .run();

    return record;
  }

  async hasSuccessfulDelivery(webhookId, deliveryKey) {
    const row = await this.db
      .prepare(
        `SELECT id
         FROM webhook_logs
         WHERE webhook_id = ?
           AND delivery_key = ?
           AND success = 1
         ORDER BY created_at DESC
         LIMIT 1`
      )
      .bind(webhookId, deliveryKey)
      .first();

    return Boolean(row);
  }

  async getLatestAttempt(webhookId, deliveryKey) {
    return this.db
      .prepare(
        `SELECT *
         FROM webhook_logs
         WHERE webhook_id = ?
           AND delivery_key = ?
         ORDER BY attempt_number DESC, created_at DESC
         LIMIT 1`
      )
      .bind(webhookId, deliveryKey)
      .first();
  }

  async getDeliveryStates(deliveryKeys = []) {
    const keys = [...new Set((deliveryKeys || []).filter(Boolean))];
    if (keys.length === 0) {
      return new Map();
    }

    const { results } = await this.db
      .prepare(
        `SELECT
           delivery_key,
           MAX(CASE WHEN success = 1 THEN 1 ELSE 0 END) AS has_success,
           MAX(attempt_number) AS latest_attempt_number
         FROM webhook_logs
         WHERE delivery_key IN ${inClause(keys)}
         GROUP BY delivery_key`
      )
      .bind(...keys)
      .all();

    return new Map(
      (results || []).map((row) => [
        row.delivery_key,
        {
          deliveryKey: row.delivery_key,
          hasSuccess: Boolean(row.has_success),
          latestAttemptNumber: Number(row.latest_attempt_number || 0),
        },
      ])
    );
  }
}

export { rowToWebhook };
