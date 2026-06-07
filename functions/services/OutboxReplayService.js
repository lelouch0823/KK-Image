import { recordAuditEvent } from '../lib/hono/_shared/audit-helpers.js';
import { DOMAIN_OUTBOX_CONSUMERS } from './DomainOutboxConsumers.js';
import { DOMAIN_EVENT_CATALOG } from './DomainEventCatalog.js';
import { OutboxReplayRepository } from '../repositories/OutboxReplayRepository.js';

const REPLAYABLE_CONSUMERS = new Set(['audit', 'cache', 'notification', 'webhook']);

export class OutboxReplayService {
  constructor(db, deps = {}) {
    this.db = db;
    this.env = deps.env || {};
    this.outboxReplayRepo = deps.outboxReplayRepo || new OutboxReplayRepository(db);
    this.consumers = deps.consumers || DOMAIN_OUTBOX_CONSUMERS;
    this.eventCatalog = deps.eventCatalog || DOMAIN_EVENT_CATALOG;
    this.auditRecorder = deps.auditRecorder || recordAuditEvent;
  }

  resolveReplayConsumers(event, requestedConsumerName = null) {
    const eventDefinition = this.eventCatalog[event.event_type];
    if (!eventDefinition) {
      throw new Error(`unsupported replay event type: ${event.event_type}`);
    }

    const replayableConsumers = (eventDefinition.consumers || []).filter((consumerName) =>
      REPLAYABLE_CONSUMERS.has(consumerName)
    );

    if (requestedConsumerName) {
      if (!REPLAYABLE_CONSUMERS.has(requestedConsumerName)) {
        throw new Error(`consumer is not replayable: ${requestedConsumerName}`);
      }
      if (!replayableConsumers.includes(requestedConsumerName)) {
        throw new Error(
          `consumer is unsupported for event ${event.event_type}: ${requestedConsumerName}`
        );
      }
      return [requestedConsumerName];
    }

    return replayableConsumers;
  }

  async dryRun({ scopeType, scopeId, consumerName = null, requestedBy = null }) {
    const events = await this.outboxReplayRepo.findEventsByScope({ scopeType, scopeId });
    const run = await this.outboxReplayRepo.createReplayRun({
      scopeType,
      scopeId,
      consumerName,
      dryRun: true,
      requestedBy,
    });

    const targetedEventIds = events.map((event) => event.id);
    const consumerNames = [
      ...new Set(events.flatMap((event) => this.resolveReplayConsumers(event, consumerName))),
    ];
    const summary = {
      dryRun: true,
      targetedEventIds,
      consumerNames,
      replayedCount: 0,
    };

    await this.outboxReplayRepo.finalizeReplayRun(run.id, summary, 'completed');

    return {
      runId: run.id,
      dryRun: true,
      ...summary,
    };
  }

  async executeReplay({ scopeType, scopeId, consumerName = null, requestedBy = null }) {
    const events = await this.outboxReplayRepo.findEventsByScope({ scopeType, scopeId });
    const run = await this.outboxReplayRepo.createReplayRun({
      scopeType,
      scopeId,
      consumerName,
      dryRun: false,
      requestedBy,
    });

    const targetedEventIds = [];
    let replayedCount = 0;

    try {
      for (const event of events) {
        targetedEventIds.push(event.id);
        const consumerNames = this.resolveReplayConsumers(event, consumerName);

        for (const resolvedConsumerName of consumerNames) {
          const consumer = this.consumers[resolvedConsumerName];
          if (typeof consumer !== 'function') {
            throw new Error(`unknown outbox consumer: ${resolvedConsumerName}`);
          }

          await consumer({
            db: this.db,
            env: this.env,
            event,
            replay: {
              runId: run.id,
              requestedBy,
              mode: 'operator_replay',
              dryRun: false,
              consumerName: resolvedConsumerName,
            },
          });

          replayedCount += 1;
          await this.auditRecorder(this.db, {
            domain: 'audit-replay',
            action: 'outbox.replay.execute',
            result: 'success',
            severity: 'high',
            targetType: 'outbox_event',
            targetId: event.id,
            target_label: event.event_type,
            summary: `Replayed ${resolvedConsumerName} for ${event.id}`,
            metadata: {
              consumerName: resolvedConsumerName,
              replayRunId: run.id,
            },
          });
        }
      }

      const summary = {
        dryRun: false,
        targetedEventIds,
        consumerNames: consumerName
          ? [consumerName]
          : [...new Set(events.flatMap((event) => this.resolveReplayConsumers(event, null)))],
        replayedCount,
      };

      await this.outboxReplayRepo.finalizeReplayRun(run.id, summary, 'completed');

      return {
        runId: run.id,
        dryRun: false,
        ...summary,
      };
    } catch (error) {
      await this.outboxReplayRepo.finalizeReplayRun(
        run.id,
        {
          dryRun: false,
          targetedEventIds,
          replayedCount,
          error: String(error?.message || error || 'unknown replay error'),
        },
        'failed'
      );
      throw error;
    }
  }
}
