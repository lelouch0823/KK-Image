import { generatePrefixedId } from '../_shared/utils.js';
import { safeJsonParse } from '../api/utils/json.js';

const OUTBOX_EVENT_ID_BATCH_SIZE = 90;
const DEFAULT_OUTBOX_LIST_LIMIT = 100;
const MAX_OUTBOX_LIST_LIMIT = 200;

export class OutboxReplayRepository {
  constructor(db, deps = {}) {
    this.db = db;
    this.now = deps.now || (() => Date.now());
    this.idFactory = deps.idFactory || (() => generatePrefixedId('replay_'));
  }

  #buildConsumerFilterSql(filters = {}, { alias = '', prefix = '' } = {}) {
    const conditions = [];
    const bindings = [];
    const consumerNameColumn = `${alias}consumer_name`;
    const statusColumn = `${alias}status`;

    if (filters.consumerName) {
      conditions.push(`${consumerNameColumn} = ?`);
      bindings.push(filters.consumerName);
    }

    if (filters.status) {
      conditions.push(`${statusColumn} = ?`);
      bindings.push(filters.status);
    }

    return {
      conditions: conditions.map((condition) => (prefix ? `${prefix}${condition}` : condition)),
      bindings,
    };
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

  async listConsumerJobsForEventIds(eventIds, filters = {}) {
    if (!eventIds.length) return new Map();

    const { conditions, bindings } = this.#buildConsumerFilterSql(filters);
    const grouped = new Map();
    for (let start = 0; start < eventIds.length; start += OUTBOX_EVENT_ID_BATCH_SIZE) {
      const batchEventIds = eventIds.slice(start, start + OUTBOX_EVENT_ID_BATCH_SIZE);
      const eventIdPlaceholders = batchEventIds.map(() => '?').join(', ');
      const whereClause = [`event_id IN (${eventIdPlaceholders})`, ...conditions].join(' AND ');
      const { results } = await this.db
        .prepare(
          `SELECT *
           FROM outbox_consumer_jobs
           WHERE ${whereClause}
           ORDER BY created_at ASC`
        )
        .bind(...batchEventIds, ...bindings)
        .all();

      for (const row of results || []) {
        const rows = grouped.get(row.event_id) || [];
        rows.push(row);
        grouped.set(row.event_id, rows);
      }
    }

    return grouped;
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

  async listEvents(filters = {}, options = {}) {
    const conditions = [];
    const bindings = [];
    const rawLimit = Number(options.limit || DEFAULT_OUTBOX_LIST_LIMIT);
    const limit = Number.isFinite(rawLimit)
      ? Math.min(Math.max(Math.trunc(rawLimit), 1), MAX_OUTBOX_LIST_LIMIT)
      : DEFAULT_OUTBOX_LIST_LIMIT;

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

    const { conditions: consumerConditions, bindings: consumerBindings } =
      this.#buildConsumerFilterSql(filters, {
        alias: 'jobs.',
      });
    if (consumerConditions.length) {
      conditions.push(
        `EXISTS (
          SELECT 1
          FROM outbox_consumer_jobs jobs
          WHERE jobs.event_id = domain_outbox.id
            AND ${consumerConditions.join(' AND ')}
        )`
      );
      bindings.push(...consumerBindings);
    }

    const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const { results } = await this.db
      .prepare(
        `SELECT *
         FROM domain_outbox
         ${whereClause}
         ORDER BY created_at DESC, sequence_in_command DESC
         LIMIT ?`
      )
      .bind(...bindings, limit)
      .all();

    const rows = results || [];
    const consumerJobsByEventId = await this.listConsumerJobsForEventIds(
      rows.map((row) => row.id),
      filters
    );

    return {
      items: rows.map((row) => ({
        ...row,
        consumerJobs: consumerJobsByEventId.get(row.id) || [],
      })),
      limit,
      isTruncated: rows.length === limit,
    };
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
          summary_json: safeJsonParse(row.summary_json || null, null),
        }
      : null;
  }
}
