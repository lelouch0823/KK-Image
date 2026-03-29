const DEFAULT_CONSUMER_STATUS = 'pending';

export class DomainOutboxRepository {
  constructor(db, deps = {}) {
    this.db = db;
    this.now = deps.now || (() => Date.now());
    this.uuid = deps.uuid || (() => crypto.randomUUID());
  }

  createEventInsertStatement(event) {
    return this.db
      .prepare(
        `INSERT INTO domain_outbox (
          id,
          command_id,
          sequence_in_command,
          event_type,
          event_version,
          aggregate_type,
          aggregate_id,
          correlation_id,
          causation_id,
          idempotency_key,
          payload_json,
          occurred_at,
          created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        event.id,
        event.command_id,
        event.sequence_in_command,
        event.event_type,
        event.event_version ?? 1,
        event.aggregate_type,
        event.aggregate_id,
        event.correlation_id,
        event.causation_id || null,
        event.idempotency_key,
        event.payload_json,
        event.occurred_at,
        event.created_at ?? this.now()
      );
  }

  createConsumerJobInsertStatement(consumerName, eventId) {
    const timestamp = this.now();

    return this.db
      .prepare(
        `INSERT INTO outbox_consumer_jobs (
          id,
          consumer_name,
          event_id,
          status,
          attempt_count,
          available_at,
          leased_by,
          leased_until,
          last_error,
          processed_at,
          created_at,
          updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        this.uuid(),
        consumerName,
        eventId,
        DEFAULT_CONSUMER_STATUS,
        0,
        timestamp,
        null,
        null,
        null,
        null,
        timestamp,
        timestamp
      );
  }

  buildInsertStatements(events = [], consumerNames = []) {
    const statements = [];

    for (const event of events) {
      statements.push(this.createEventInsertStatement(event));

      for (const consumerName of consumerNames) {
        statements.push(this.createConsumerJobInsertStatement(consumerName, event.id));
      }
    }

    return statements;
  }
}
