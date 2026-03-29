import { describe, expect, it, vi } from 'vitest';
import { listForAdmin } from '../order/queries.js';

describe('order queries progress-status filtering', () => {
  it('filters admin list queries by resolved display status instead of legacy procurement_status', async () => {
    const countStmt = {
      bind: vi.fn(() => countStmt),
      first: vi.fn(async () => ({ total: 0 })),
    };
    const listStmt = {
      bind: vi.fn(() => listStmt),
      all: vi.fn(async () => ({ results: [] })),
    };
    const db = {
      prepare: vi.fn().mockReturnValueOnce(countStmt).mockReturnValueOnce(listStmt),
    };

    await listForAdmin(db, {
      procurementStatus: 'partially_received',
      page: 1,
      limit: 20,
    });

    expect(db.prepare.mock.calls[0][0]).toContain("COALESCE(order_line_agg.display_status, o.procurement_status, 'none') = ?");
    expect(db.prepare.mock.calls[1][0]).toContain("COALESCE(order_line_agg.display_status, o.procurement_status, 'none') = ?");
    expect(countStmt.bind).toHaveBeenCalledWith('partially_received');
    expect(listStmt.bind).toHaveBeenCalledWith('partially_received', 20, 0);
  });
});
