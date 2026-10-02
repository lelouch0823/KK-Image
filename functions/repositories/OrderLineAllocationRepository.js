export class OrderLineAllocationRepository {
  constructor(db) {
    this.db = db;
  }

  normalizePayload(payload = {}) {
    const id = payload.id || crypto.randomUUID();
    const now = payload.created_at ?? Date.now();
    const updatedAt = payload.updated_at ?? now;
    const allocatedAt = payload.allocated_at ?? now;
    const releasedQty = payload.released_qty ?? 0;
    const releasedAt = payload.released_at ?? null;
    const hasRelease = releasedQty > 0 || releasedAt !== null;
    const status = payload.status || (hasRelease ? 'released' : 'active');

    return {
      ...payload,
      id,
      status,
      allocated_at: allocatedAt,
      released_at: releasedAt,
      released_qty: releasedQty,
      created_at: now,
      updated_at: updatedAt,
    };
  }

  createInsertStatement(payload) {
    const normalized = this.normalizePayload(payload);

    return this.db
      .prepare(
        `INSERT INTO order_line_allocations (
          id,
          order_line_id,
          variant_id,
          inventory_event_id,
          allocated_qty,
          released_qty,
          status,
          allocated_at,
          released_at,
          created_at,
          updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        normalized.id,
        normalized.order_line_id,
        normalized.variant_id || null,
        normalized.inventory_event_id || null,
        normalized.allocated_qty ?? 0,
        normalized.released_qty,
        normalized.status,
        normalized.allocated_at,
        normalized.released_at,
        normalized.created_at,
        normalized.updated_at
      );
  }

  async create(payload) {
    const normalized = this.normalizePayload(payload);
    await this.createInsertStatement(normalized).run();

    return {
      id: normalized.id,
      status: normalized.status,
      allocated_at: normalized.allocated_at,
      released_at: normalized.released_at,
      created_at: normalized.created_at,
      updated_at: normalized.updated_at,
    };
  }

  async listActiveByOrderLine(orderLineId) {
    const { results } = await this.db
      .prepare(
        `SELECT
            id,
            order_line_id,
            variant_id,
            inventory_event_id,
            allocated_qty,
            released_qty,
            status,
            allocated_at,
            released_at,
            created_at,
            updated_at
         FROM order_line_allocations
         WHERE order_line_id = ?
           AND status = 'active'
           AND COALESCE(allocated_qty, 0) > COALESCE(released_qty, 0)
         ORDER BY allocated_at ASC, created_at ASC`
      )
      .bind(orderLineId)
      .all();

    return (results || []).map((row) => ({
      ...row,
      allocated_qty: Number(row.allocated_qty || 0),
      released_qty: Number(row.released_qty || 0),
    }));
  }

  buildReleaseStatement(allocation, quantity, options = {}) {
    const releaseQty = Math.max(0, Number(quantity) || 0);
    const timestamp = options.now ?? options.released_at ?? Date.now();

    // released_qty 在 SQL 内做相对累加（而非回写 JS 预计算的绝对值）：
    // 两个并发部分释放各自基于同一快照计算会互相覆盖（丢失更新），
    // 相对更新 + MIN 封顶保证并发安全；status 由 CASE 与 released_qty 同步推导
    return this.db
      .prepare(
        `UPDATE order_line_allocations
         SET released_qty = MIN(COALESCE(allocated_qty, 0), COALESCE(released_qty, 0) + ?),
             released_at = CASE
               WHEN MIN(COALESCE(allocated_qty, 0), COALESCE(released_qty, 0) + ?) >= COALESCE(allocated_qty, 0)
                 THEN ?
               ELSE COALESCE(released_at, ?)
             END,
             status = CASE
               WHEN MIN(COALESCE(allocated_qty, 0), COALESCE(released_qty, 0) + ?) >= COALESCE(allocated_qty, 0)
                 THEN 'released'
               ELSE 'active'
             END,
             updated_at = ?
         WHERE id = ?`
      )
      .bind(
        releaseQty,
        releaseQty,
        timestamp,
        timestamp,
        releaseQty,
        options.updated_at ?? timestamp,
        allocation.id
      );
  }
}
