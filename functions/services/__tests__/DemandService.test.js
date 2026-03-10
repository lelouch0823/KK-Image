import { describe, expect, it, vi } from 'vitest';
import { DemandService } from '../DemandService.js';

describe('DemandService', () => {
  it('treats confirmed orders as active demand creation', async () => {
    const service = new DemandService({});
    const effect = await service.syncOrderTransition({ fromStatus: 'pending', toStatus: 'confirmed' });

    expect(effect).toEqual({
      createsDemand: true,
      releasesDemand: false,
      stockDeductionPending: false,
    });
  });

  it('releases demand when confirmed orders are voided, rejected, or cancelled', async () => {
    const service = new DemandService({});

    await expect(service.syncOrderTransition({ fromStatus: 'confirmed', toStatus: 'void' }))
      .resolves.toMatchObject({ releasesDemand: true });
    await expect(service.syncOrderTransition({ fromStatus: 'confirmed', toStatus: 'rejected' }))
      .resolves.toMatchObject({ releasesDemand: true });
    await expect(service.syncOrderTransition({ fromStatus: 'confirmed', toStatus: 'cancelled' }))
      .resolves.toMatchObject({ releasesDemand: true });
  });

  it('flags shipping and delivered transitions for later stock deduction integration', async () => {
    const service = new DemandService({});

    await expect(service.syncOrderTransition({ fromStatus: 'confirmed', toStatus: 'shipping' }))
      .resolves.toMatchObject({ stockDeductionPending: true });
    await expect(service.syncOrderTransition({ fromStatus: 'confirmed', toStatus: 'delivered' }))
      .resolves.toMatchObject({ stockDeductionPending: true });
  });

  it('aggregates confirmed demand by variant', async () => {
    const stmt = {
      all: vi.fn(async () => ({
        results: [
          { variant_id: 'variant-1', total_demand: 5, order_count: 2, order_ids: 'o-1,o-2' },
        ],
      })),
    };
    const service = new DemandService({
      prepare: vi.fn(() => stmt),
    });

    const rows = await service.getDemandSummaryByVariant();

    expect(rows).toEqual([
      {
        variant_id: 'variant-1',
        total_demand: 5,
        order_count: 2,
        order_ids: ['o-1', 'o-2'],
      },
    ]);
  });
});
