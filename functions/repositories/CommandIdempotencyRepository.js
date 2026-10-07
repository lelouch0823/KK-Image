const RECEIPT_COMMAND_TYPE = 'purchase_receipt_record';
const RECEIPT_REVERSAL_COMMAND_TYPE = 'purchase_receipt_reversal';
const SHORTAGE_CLOSURE_COMMAND_TYPE = 'purchase_shortage_closure';

// in_flight 记录的 stale 窗口：持有进程在 reserve 之后、finalize 之前崩溃时，
// 记录会永久停留 in_flight 并阻塞同键重试。超过该窗口的孤儿记录可被
// 后续同键请求原子接管（与 order-procurement-resource-locks 的自愈语义一致）。
export const DEFAULT_COMMAND_STALE_MS = 10 * 60 * 1000;

export class CommandIdempotencyRepository {
  constructor(db, deps = {}) {
    this.db = db;
    this.now = deps.now || (() => Date.now());
    this.uuid = deps.uuid || (() => crypto.randomUUID());
    this.staleMs = Number.isFinite(deps.staleMs) ? deps.staleMs : DEFAULT_COMMAND_STALE_MS;
  }

  async reserveReceiptCommand(scopeKey, idempotencyKey, requestFingerprint) {
    return this.reserveCommand(RECEIPT_COMMAND_TYPE, scopeKey, idempotencyKey, requestFingerprint);
  }

  async reserveReversalCommand(scopeKey, idempotencyKey, requestFingerprint) {
    return this.reserveCommand(
      RECEIPT_REVERSAL_COMMAND_TYPE,
      scopeKey,
      idempotencyKey,
      requestFingerprint
    );
  }

  async reserveShortageClosureCommand(scopeKey, idempotencyKey, requestFingerprint) {
    return this.reserveCommand(
      SHORTAGE_CLOSURE_COMMAND_TYPE,
      scopeKey,
      idempotencyKey,
      requestFingerprint
    );
  }

  buildInsertStatement(record) {
    return this.db
      .prepare(
        `INSERT OR IGNORE INTO command_idempotency (
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
      );
  }

  async reserveCommand(commandType, scopeKey, idempotencyKey, requestFingerprint) {
    const timestamp = this.now();
    const record = {
      id: this.uuid(),
      command_type: commandType,
      scope_key: scopeKey,
      idempotency_key: idempotencyKey,
      command_id: this.uuid(),
      request_fingerprint: requestFingerprint,
      response_json: null,
      status: 'in_flight',
      created_at: timestamp,
      updated_at: timestamp,
    };

    const insertResult = await this.buildInsertStatement(record).run();
    const persisted = await this.db
      .prepare(
        `SELECT * FROM command_idempotency
         WHERE command_type = ? AND scope_key = ? AND idempotency_key = ?`
      )
      .bind(commandType, scopeKey, idempotencyKey)
      .first();
    const ownsReservation = Number(insertResult?.meta?.changes || 0) === 1;

    if (!ownsReservation) {
      // in_flight 孤儿记录自愈：持有进程崩溃后记录永远停在 in_flight，
      // 同键重试会被"仍在处理中"永久阻塞。超过 stale 窗口的记录原子接管
      // （时间戳谓词 DELETE + 重新预留），接管成功则由调用方重新执行命令
      const takenOver = await this.takeOverStaleInFlightCommand({
        commandType,
        scopeKey,
        idempotencyKey,
        record,
        persisted,
      });
      if (takenOver) return takenOver;
    }

    return {
      existing: !ownsReservation,
      record: persisted || record,
      insertStatement: null,
      ownsReservation,
    };
  }

  /**
   * 尝试接管超过 stale 窗口的 in_flight 记录。
   * 参照 buildStealStaleLockStatement（资源锁自愈）：单条带时间戳谓词的
   * DELETE（仅命中仍处于 in_flight 且 updated_at 早于 staleBefore 的记录，
   * changes()=1 即取得所有权）后重新预留；谓词在 DB 内重新校验，
   * 与并发接管者之间由 changes() 仲裁，不会双接管。
   * @returns {Promise<Object|null>} 接管成功返回新的预留结果，否则 null
   */
  async takeOverStaleInFlightCommand({
    commandType,
    scopeKey,
    idempotencyKey,
    record,
    persisted,
  }) {
    const staleBefore = this.now() - this.staleMs;
    if (
      !persisted ||
      persisted.status !== 'in_flight' ||
      Number(persisted.updated_at || 0) >= staleBefore
    ) {
      return null;
    }

    const stealResult = await this.buildStealStaleLockStatement({
      commandType,
      scopeKey,
      idempotencyKey,
      staleBefore,
    }).run();
    if (Number(stealResult?.meta?.changes || 0) !== 1) return null;

    const reinsertResult = await this.buildInsertStatement(record).run();
    if (Number(reinsertResult?.meta?.changes || 0) !== 1) return null;

    console.warn(
      `[CommandIdempotency] Took over stale in_flight command (type=${commandType}, key=${idempotencyKey}, staleBefore=${staleBefore})`
    );
    return {
      existing: false,
      record,
      insertStatement: null,
      ownsReservation: true,
    };
  }

  buildDeleteStatement(commandId) {
    return this.db.prepare('DELETE FROM command_idempotency WHERE command_id = ?').bind(commandId);
  }

  /**
   * 构建删除过期 in_flight 记录的语句（stale steal）。
   *
   * 仅删除仍处于 in_flight 且 updated_at 早于 staleBefore 的记录：
   * 资源锁在持有进程崩溃后无人释放（正常完成的锁与业务写入同批次删除），
   * 命令幂等预留同理（Worker 在 reserve 与 finalize 之间被杀），
   * 若无自愈机制会永久阻塞该资源/命令的后续请求。由调用方传入时间下限。
   */
  buildStealStaleLockStatement({ commandType, scopeKey, idempotencyKey, staleBefore }) {
    return this.db
      .prepare(
        `DELETE FROM command_idempotency
         WHERE command_type = ?
           AND scope_key = ?
           AND idempotency_key = ?
           AND status = 'in_flight'
           AND updated_at < ?`
      )
      .bind(commandType, scopeKey, idempotencyKey, staleBefore);
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
