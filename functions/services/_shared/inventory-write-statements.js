/**
 * 库存写入语句构建（共享，唯一入口）
 * ============================================
 *
 * 所有 product_variants.stock_quantity 与 inventory_balances 的写入必须经由
 * 此模块构建，保证（并发审查 C-H1/C-H2 的系统性修复）：
 *
 * 1. 拒绝钳制：不再使用 MAX(0, …) 静默吞掉负值——负库存是异常，必须让
 *    整个 batch 失败并回滚，否则 inventory_ledger 与余额会永久背离、无法对账；
 * 2. 数据库层兜底：inventory_balances 的 CHECK(on_hand>=0 AND reserved>=0 AND
 *    available>=0)（migration 0099）使任何越限写入在语句级直接失败；
 * 3. 单语句原子性：余额三列（on_hand/reserved/available）在同一条 UPSERT 内
 *    一致推导（available = MAX(on_hand - reserved, 0)，展示层钳制语义），
 *    并发请求各自以读到的行状态为基线做相对增量，由 CHECK/谓词仲裁，
 *    无需 check-then-act；
 * 4. 写入者收敛：InventoryService（库存事件）、行级履约（预留移动）、
 *    DemandService（订单状态机预留）共用同一构建器，语义不再漂移。
 *
 * 失败语义：越限写入抛出 SQLite 约束错误 → 调用方通过
 * normalizeInventoryWriteError / runGuardedBatch 映射为 ConflictError。
 */
import { ConflictError } from '../../lib/hono/errors.js';

/** D1/SQLite CHECK 约束失败错误匹配（不同驱动文案可能带表名前缀） */
export function isInventoryConstraintError(error) {
  const message = String(error?.message || error);
  return message.includes('CHECK constraint failed');
}

/**
 * 将 batch 执行错误规范化：库存越限 → 409 冲突，保留其余错误语义。
 * 与 runGuardedBatch 的 changes() 断言（"malformed json"）互补。
 */
export function normalizeInventoryWriteError(error, conflictMessage) {
  if (isInventoryConstraintError(error)) {
    return new ConflictError(
      conflictMessage || '库存余额越限（库存不足或超预留），操作已回滚'
    );
  }
  return error;
}

/**
 * 构建 product_variants.stock_quantity 相对增量语句。
 *
 * 负增量带 `stock_quantity + ? >= 0` 谓词（changes()=0 → 断言语句失败 →
 * batch 回滚）；正增量无条件写。与 inventory_balances.on_hand 的变更必须
 * 出现在同一个 batch 中。
 *
 * @returns {{statement: D1PreparedStatement, guarded: boolean}}
 */
export function buildVariantStockDeltaStatement(db, { variantId, quantityDelta, timestamp }) {
  if (quantityDelta >= 0) {
    return {
      guarded: false,
      statement: db
        .prepare(
          `UPDATE product_variants
           SET stock_quantity = stock_quantity + ?, updated_at = ?
           WHERE id = ?`
        )
        .bind(quantityDelta, timestamp, variantId),
    };
  }
  return {
    guarded: true,
    statement: db
      .prepare(
        `UPDATE product_variants
         SET stock_quantity = stock_quantity + ?, updated_at = ?
         WHERE id = ? AND stock_quantity + ? >= 0`
      )
      .bind(quantityDelta, timestamp, variantId, quantityDelta),
  };
}

/**
 * 构建 inventory_balances 相对增量 UPSERT。
 *
 * 语义约定（与 InventoryBusinessWorkflow 业务规格一致）：
 * - on_hand / reserved 相对增量，越限（< 0）由 0099 CHECK 约束拒绝并回滚；
 * - available 恒重算为 MAX(on_hand - reserved, 0)（钳制展示语义）；
 * - 订单级预留（DemandService）是需求驱动的软锁定，允许 reserved > on_hand
 *   （预订/backorder 模式），因此本构建器不做 available 下限守卫；
 * - 行级硬预留（reserve 命令）必须使用 buildGuardedHoldUpsertStatement，
 *   由 WHERE 谓词拒绝超可用预留。
 *
 * @returns {D1PreparedStatement}
 */
export function buildBalanceDeltaUpsertStatement(db, {
  variantId,
  onHandDelta,
  reservedDelta,
  timestamp,
}) {
  return db
    .prepare(
      `INSERT INTO inventory_balances (variant_id, on_hand, reserved, available, updated_at)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(variant_id) DO UPDATE SET
         on_hand = inventory_balances.on_hand + ?,
         reserved = inventory_balances.reserved + ?,
         available = MAX((inventory_balances.on_hand + ?) - (inventory_balances.reserved + ?), 0),
         updated_at = excluded.updated_at`
    )
    .bind(
      variantId,
      onHandDelta,
      reservedDelta,
      Math.max(onHandDelta - reservedDelta, 0),
      timestamp,
      onHandDelta,
      reservedDelta,
      onHandDelta,
      reservedDelta
    );
}

/**
 * 行级硬预留 UPSERT（C-H2）。
 *
 * 与 buildBalanceDeltaUpsertStatement 的差别：冲突分支带
 * `on_hand - (reserved + ?) >= 0` 谓词——两个并发 reserve 都通过 batch 外的
 * 容量检查时，只有能让谓词成立的那一个会写入；谓词失败 changes()=0，
 * 紧随的 changes() 断言语句使整个 batch 失败回滚（409 冲突）。
 *
 * 首建分支（行不存在）仅接受非负基线：新变体没有库存，预留不落库，
 * 由调用方的容量预检（available=0）拒绝。
 *
 * @returns {Array<D1PreparedStatement>} [upsert, changesAssertion]
 */
export function buildGuardedHoldUpsertStatement(db, { variantId, reservedDelta, timestamp }) {
  if (reservedDelta <= 0) {
    throw new Error('buildGuardedHoldUpsertStatement requires a positive reservedDelta');
  }
  return [
    db
      .prepare(
        `INSERT INTO inventory_balances (variant_id, on_hand, reserved, available, updated_at)
         VALUES (?, 0, ?, 0, ?)
         ON CONFLICT(variant_id) DO UPDATE SET
           reserved = inventory_balances.reserved + ?,
           available = MAX(inventory_balances.on_hand - (inventory_balances.reserved + ?), 0),
           updated_at = excluded.updated_at
         WHERE inventory_balances.on_hand - (inventory_balances.reserved + ?) >= 0`
      )
      .bind(variantId, reservedDelta, timestamp, reservedDelta, reservedDelta, reservedDelta),
    buildChangesAssertionStatement(db),
  ];
}

/**
 * changes() 断言语句：前一条 UPDATE/UPSERT 未命中（changes()=0）时，
 * json_extract 解析非 JSON 字面量抛出 "malformed JSON" 错误，使 batch 回滚。
 * 由 runGuardedBatch 将该错误映射为 ConflictError。
 */
export function buildChangesAssertionStatement(db) {
  return db.prepare(
    "SELECT json_extract(CASE WHEN changes() = 1 THEN '{}' ELSE 'not-json' END, '$') AS guard_ok"
  );
}
