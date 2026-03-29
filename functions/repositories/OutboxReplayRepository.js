import { generatePrefixedId } from '../_shared/utils.js';

function parseSummaryJson(value) {
  if (!value) return null;
  if (typeof value === 'object') return value;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

export class OutboxReplayRepository {
  constructor(db, deps = {}) {
    this.db = db;
    this.now = deps.now || (() => Date.now());
    this.idFactory = deps.idFactory || (() => generatePrefixedId('replay_'));
  }

  async listConsumerJobs(eventId) {
    const { results } = await this.db
      .prepare(
        `SELECT *
         FROM outbox_consumer_jobs
         WHERE event_id = ?
         ORDER BY created_at ASC`
      )
      .bind(eventId)
      .all();

    return results || [];
  }

  async listWebhookAttempts(eventId) {
    const { results } = await this.db
      .prepare(
        `SELECT *
         FROM webhook_logs
         WHERE event_id = ?
         ORDER BY created_at DESC`
      )
      .bind(eventId)
      .all();

    return results || [];
  }

  async attachReplayState(event) {
    return {
      ...event,
      consumerJobs: await this.listConsumerJobs(event.id),
      webhookAttempts: await this.listWebhookAttempts(event.id),
    };
  }

  async listEvents(filters = {}) {
    const conditions = [];
    const bindings = [];

    if (filters.eventType) {
      conditions.push('event_type = ?');
      bindings.push(filters.eventType);
    }
    if (filters.aggregateType) {
      conditions.push('aggregate_type = ?');
      bindings.push(filters.aggregateType);
    }
    if (filters.aggregateId) {
      conditions.push('aggregate_id = ?');
      bindings.push(filters.aggregateId);
    }

    const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const { results } = await this.db
      .prepare(
        `SELECT *
         FROM domain_outbox
         ${whereClause}
         ORDER BY created_at DESC, sequence_in_command DESC`
      )
      .bind(...bindings)
      .all();

    const rows = results || [];
    return Promise.all(rows.map((row) => this.attachReplayState(row)));
  }

  async getEventDetail(eventId) {
    const { results } = await this.db
      .prepare(
        `SELECT *
         FROM domain_outbox
         WHERE id = ?`
      )
      .bind(eventId)
      .all();

    if (!results?.[0]) return null;
    return this.attachReplayState(results[0]);
  }

  async findEventsByScope({ scopeType, scopeId }) {
    let sql = `SELECT * FROM domain_outbox`;
    let bindings = [];

    if (scopeType === 'command') {
      sql += ' WHERE command_id = ? ORDER BY sequence_in_command ASC';
      bindings = [scopeId];
    } else if (scopeType === 'event') {
      sql += ' WHERE id = ?';
      bindings = [scopeId];
    } else {
      throw new Error(`unsupported replay scope: ${scopeType}`);
    }

    const { results } = await this.db.prepare(sql).bind(...bindings).all();
    return results || [];
  }

  async createReplayRun({ scopeType, scopeId, consumerName = null, dryRun = true, requestedBy = null }) {
    const timestamp = this.now();
    const record = {
      id: this.idFactory(),
      scope_type: scopeType,
      scope_id: scopeId,
      consumer_name: consumerName,
      dry_run: dryRun ? 1 : 0,
      status: 'pending',
      requested_by: requestedBy,
      summary_json: null,
      created_at: timestamp,
      updated_at: timestamp,
      completed_at: null,
    };

    await this.db
      .prepare(
        `INSERT INTO outbox_replay_runs (
          id,
          scope_type,
          scope_id,
          consumer_name,
          dry_run,
          status,
          requested_by,
          summary_json,
          created_at,
          updated_at,
          completed_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        record.id,
        record.scope_type,
        record.scope_id,
        record.consumer_name,
        record.dry_run,
        record.status,
        record.requested_by,
        record.summary_json,
        record.created_at,
        record.updated_at,
        record.completed_at
      )
      .run();

    return record;
  }

  async finalizeReplayRun(runId, summary, status = 'completed') {
    const timestamp = this.now();
    await this.db
      .prepare(
        `UPDATE outbox_replay_runs
         SET status = ?,
             summary_json = ?,
             updated_at = ?,
             completed_at = ?
         WHERE id = ?`
      )
      .bind(status, JSON.stringify(summary || {}), timestamp, timestamp, runId)
      .run();

    const row = await this.db
      .prepare('SELECT * FROM outbox_replay_runs WHERE id = ?')
      .bind(runId)
      .first();

    return row
      ? {
          ...row,
          summary_json: parseSummaryJson(row.summary_json),
        }
      : null;
  }
}
