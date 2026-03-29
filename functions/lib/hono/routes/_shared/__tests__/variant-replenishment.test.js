import { describe, expect, it, vi } from 'vitest';
import { loadVariantReplenishmentMap } from '../variant-replenishment.js';

describe('loadVariantReplenishmentMap', () => {
  it('uses outstanding inbound quantity instead of raw purchase quantity', async () => {
    const stmt = {
      bind: vi.fn(() => stmt),
      all: vi.fn(async () => ({
        results: [
          {
            variant_id: 'var-1',
            replenishment_quantity: 3,
            replenishment_po_count: 1,
          },
        ],
      })),
    };
    const db = {
      prepare: vi.fn(() => stmt),
    };

    const map = await loadVariantReplenishmentMap(db, ['var-1']);
    const sql = db.prepare.mock.calls[0][0];

    expect(sql).toContain('MAX(COALESCE(poi.quantity, 0) - COALESCE(poi.received_qty, 0) - COALESCE(poi.cancelled_qty, 0), 0)');
    expect(sql).toContain("po.status IN ('ordered', 'shipping')");
    expect(map.get('var-1')).toEqual({
      replenishment_quantity: 3,
      replenishment_po_count: 1,
    });
  });

  it('returns an empty map when no variant ids are provided', async () => {
    const db = {
      prepare: vi.fn(),
    };

    const map = await loadVariantReplenishmentMap(db, []);

    expect(map).toBeInstanceOf(Map);
    expect(map.size).toBe(0);
    expect(db.prepare).not.toHaveBeenCalled();
  });
});
