const RECEIPT_COMMAND_TYPE = 'purchase_receipt_record';

export class CommandIdempotencyRepository {
  constructor(db, deps = {}) {
    this.db = db;
    this.now = deps.now || (() => Date.now());
    this.uuid = deps.uuid || (() => crypto.randomUUID());
  }

  async reserveReceiptCommand(scopeKey, idempotencyKey, requestFingerprint) {
    const existing = await this.db
      .prepare(
        `SELECT * FROM command_idempotency
         WHERE command_type = ? AND scope_key = ? AND idempotency_key = ?`
      )
      .bind(RECEIPT_COMMAND_TYPE, scopeKey, idempotencyKey)
      .first();

    if (existing) {
      return {
        existing: true,
        record: existing,
        insertStatement: null,
      };
    }

    const timestamp = this.now();
    const record = {
      id: this.uuid(),
      command_type: RECEIPT_COMMAND_TYPE,
      scope_key: scopeKey,
      idempotency_key: idempotencyKey,
      command_id: this.uuid(),
      request_fingerprint: requestFingerprint,
      response_json: null,
      status: 'in_flight',
      created_at: timestamp,
      updated_at: timestamp,
    };

    return {
      existing: false,
      record,
      insertStatement: this.db
        .prepare(
          `INSERT INTO command_idempotency (
            id,
            command_type,
            scope_key,
            idempotency_key,
            command_id,
            request_fingerprint,
            response_json,
            status,
            created_at,
            updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .bind(
          record.id,
          record.command_type,
          record.scope_key,
          record.idempotency_key,
          record.command_id,
          record.request_fingerprint,
          record.response_json,
          record.status,
          record.created_at,
          record.updated_at
        ),
    };
  }

  buildFinalizeStatement(commandId, responseJson, status = 'committed') {
    const timestamp = this.now();

    return this.db
      .prepare(
        `UPDATE command_idempotency
         SET response_json = ?,
             status = ?,
             updated_at = ?
         WHERE command_id = ?`
      )
      .bind(
        responseJson == null ? null : JSON.stringify(responseJson),
        status,
        timestamp,
        commandId
      );
  }
}
