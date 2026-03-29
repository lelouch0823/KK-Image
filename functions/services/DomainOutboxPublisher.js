import { DomainOutboxRepository } from '../repositories/DomainOutboxRepository.js';
import { getDomainEventDefinition } from './DomainEventCatalog.js';

const D1_MAX_BATCH_SIZE = 100;

function chunkArray(items = [], chunkSize = D1_MAX_BATCH_SIZE) {
  if (!Array.isArray(items) || items.length === 0) return [];

  const chunks = [];
  for (let index = 0; index < items.length; index += chunkSize) {
    chunks.push(items.slice(index, index + chunkSize));
  }
  return chunks;
}

async function executeBatchChunks(db, statements = []) {
  for (const chunk of chunkArray(statements)) {
    await db.batch(chunk);
  }
}

export class DomainOutboxPublisher {
  constructor(db, deps = {}) {
    this.db = db;
    this.domainOutboxRepo = deps.domainOutboxRepo || new DomainOutboxRepository(db, { now: deps.now });
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
      idempotency_key: event.idempotency_key || `${commandId}:${eventType}:${event.aggregate_id || sequenceInCommand}`,
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

    const statements = this.domainOutboxRepo.buildInsertStatements(
      normalizedEvents,
      (event) => getDomainEventDefinition(event.event_type).consumers
    );
    await executeBatchChunks(this.db, statements);
    return normalizedEvents;
  }
}
