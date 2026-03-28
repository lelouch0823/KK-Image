export class OrderLineAllocationRepository {
  constructor(db) {
    this.db = db;
  }

  async create(payload) {
    const id = payload.id || crypto.randomUUID();
    const now = payload.created_at ?? Date.now();
    const updatedAt = payload.updated_at ?? now;
    const allocatedAt = payload.allocated_at ?? now;
    const releasedAt = payload.released_at ?? null;

    await this.db
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
        id,
        payload.order_line_id,
        payload.variant_id || null,
        payload.inventory_event_id || null,
        payload.allocated_qty ?? 0,
        payload.released_qty ?? 0,
        payload.status || 'active',
        allocatedAt,
        releasedAt,
        now,
        updatedAt
      )
      .run();

    return { id, allocated_at: allocatedAt, released_at: releasedAt, created_at: now, updated_at: updatedAt };
  }
}
