import { describe, expect, it, vi } from 'vitest';
import {
  findActiveBindingsByPreOrderIds,
  getLastPurchasePricesByVariant,
  getLinkedOrderIds,
} from '../purchase-order-links.js';

describe('purchase-order links helpers', () => {
  it('loads linked pre-order ids from repository rows', async () => {
    const db = {
      prepare: vi.fn(() => ({
        bind: vi.fn(() => ({
          all: vi.fn(async () => ({
            results: [{ pre_order_id: 'order-1' }, { pre_order_id: 'order-2' }],
          })),
        })),
      })),
    };

    await expect(getLinkedOrderIds({ db, poId: 'po-1' })).resolves.toEqual(['order-1', 'order-2']);
  });

  it('chunks active binding lookups and flattens results', async () => {
    const all = vi.fn(async () => ({
      results: [{ pre_order_id: 'order-1', po_id: 'po-1', po_no: 'PO-1', po_status: 'ordered' }],
    }));
    const db = {
      prepare: vi.fn(() => ({
        bind: vi.fn(() => ({ all })),
      })),
    };

    await expect(
      findActiveBindingsByPreOrderIds({ db, preOrderIds: ['order-1', 'order-1'] })
    ).resolves.toEqual([
      { pre_order_id: 'order-1', po_id: 'po-1', po_no: 'PO-1', po_status: 'ordered' },
    ]);
  });

  it('maps latest purchase prices once per variant id', async () => {
    const db = {
      prepare: vi.fn(() => ({
        bind: vi.fn(() => ({
          all: vi.fn(async () => ({
            results: [
              { variant_id: 'variant-1', last_purchase_price: 20 },
              { variant_id: 'variant-1', last_purchase_price: 30 },
              { variant_id: 'variant-2', last_purchase_price: 15 },
            ],
          })),
        })),
      })),
    };

    await expect(
      getLastPurchasePricesByVariant({ db, variantIds: ['variant-1', 'variant-2'] })
    ).resolves.toEqual({
      'variant-1': 20,
      'variant-2': 15,
    });
  });
});
