import { executeBatchChunks } from '../lib/db/batch.js';
import { DomainOutboxRepository } from '../repositories/DomainOutboxRepository.js';
import { getDomainEventDefinition } from './DomainEventCatalog.js';
import { runOutboxPoller } from '../api/cron/outbox.js';

const D1_MAX_BATCH_SIZE = 100;

export class DomainOutboxPublisher {
  constructor(db, deps = {}) {
    this.db = db;
    this.domainOutboxRepo =
      deps.domainOutboxRepo || new DomainOutboxRepository(db, { now: deps.now });
    this.now = deps.now || (() => Date.now());
    this.uuid = deps.uuid || (() => crypto.randomUUID());
  }

  normalizeEvent(event = {}, commandId, correlationId, sequenceInCommand) {
    const eventType = String(event.event_type || '').trim();
    const definition = getDomainEventDefinition(eventType);

    return {
      id: event.id || this.uuid(),
      command_id: event.command_id || commandId,
      sequence_in_command: event.sequence_in_command || sequenceInCommand,
      event_type: eventType,
      event_version: event.event_version || definition.version || 1,
      aggregate_type: event.aggregate_type,
      aggregate_id: event.aggregate_id,
      correlation_id: event.correlation_id || correlationId,
      causation_id: event.causation_id || correlationId,
      idempotency_key:
        event.idempotency_key ||
        `${commandId}:${eventType}:${event.aggregate_id || sequenceInCommand}`,
      payload_json: JSON.stringify(event.payload || {}),
      occurred_at: event.occurred_at || this.now(),
    };
  }

  async publish(events = [], options = {}) {
    if (!Array.isArray(events) || events.length === 0) return [];

    const commandId = options.commandId || this.uuid();
    const correlationId = options.correlationId || commandId;
    const normalizedEvents = events.map((event, index) =>
      this.normalizeEvent(event, commandId, correlationId, index + 1)
    );

    const eventChunks = [];
    let currentChunk = [];
    let currentStatementCount = 0;

    for (const event of normalizedEvents) {
      const statementCountForEvent =
        1 + getDomainEventDefinition(event.event_type).consumers.length;
      if (
        currentChunk.length > 0 &&
        currentStatementCount + statementCountForEvent > D1_MAX_BATCH_SIZE
      ) {
        eventChunks.push(currentChunk);
        currentChunk = [];
        currentStatementCount = 0;
      }
      currentChunk.push(event);
      currentStatementCount += statementCountForEvent;
    }

    if (currentChunk.length > 0) {
      eventChunks.push(currentChunk);
    }

    const persistedEventIds = [];
    try {
      for (const eventChunk of eventChunks) {
        const statements = this.domainOutboxRepo.buildInsertStatements(
          eventChunk,
          (event) => getDomainEventDefinition(event.event_type).consumers
        );
        await this.db.batch(statements);
        persistedEventIds.push(...eventChunk.map((event) => event.id));
      }
    } catch (error) {
      if (persistedEventIds.length > 0) {
        // 回滚时同时清理 domain_outbox 和 outbox_consumer_jobs 中关联的记录
        const rollbackStatements = persistedEventIds.flatMap((eventId) => [
          this.db.prepare('DELETE FROM outbox_consumer_jobs WHERE event_id = ?').bind(eventId),
          this.db.prepare('DELETE FROM domain_outbox WHERE id = ?').bind(eventId),
        ]);
        try {
          await executeBatchChunks(this.db, rollbackStatements);
        } catch (rollbackError) {
          console.error('Domain outbox rollback failed:', rollbackError);
        }
      }
      throw error;
    }

    return normalizedEvents;
  }
}

/**
 * 发布 outbox 事件并调度 poller 执行
 * 封装常见的 "publish + waitUntil(runOutboxPoller)" 模式
 * @param {object} c - Hono context
 * @param {object} options
 * @param {Array} options.events - 要发布的事件列表
 * @param {string} [options.workerId] - outbox poller worker ID
 * @param {string} [options.commandId] - 命令 ID
 * @param {string} [options.correlationId] - 关联 ID
 * @returns {Promise<Array>} 发布的事件列表
 */
export async function publishAndSchedulePoll(
  c,
  { events, workerId, commandId, correlationId } = {}
) {
  const publisher = new DomainOutboxPublisher(c.env.DB);
  const published = await publisher.publish(events, { commandId, correlationId });
  c.executionCtx?.waitUntil?.(
    runOutboxPoller({
      env: c.env,
      requestUrl: c.req?.url || 'unknown://publish',
      workerId: workerId || `outbox:${Date.now()}`,
    })
  );
  return published;
}
