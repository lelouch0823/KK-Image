import { describe, expect, it } from 'vitest';
import { DemandService } from '../DemandService.js';

describe('Demand reservation projection', () => {
  it('creates reservation on confirm, releases on cancellation, and consumes reservation on delivery', async () => {
    const service = new DemandService({});

    await expect(
      service.syncOrderTransition({ fromStatus: 'pending', toStatus: 'confirmed', quantity: 4, variantId: 'v-1' })
    ).resolves.toMatchObject({
      reservationDelta: 4,
      shipmentDelta: 0,
      createsDemand: true,
      releasesDemand: false,
      consumesReservation: false,
    });

    await expect(
      service.syncOrderTransition({ fromStatus: 'confirmed', toStatus: 'void', quantity: 4, variantId: 'v-1' })
    ).resolves.toMatchObject({
      reservationDelta: -4,
      shipmentDelta: 0,
      createsDemand: false,
      releasesDemand: true,
      consumesReservation: false,
    });

    await expect(
      service.syncOrderTransition({ fromStatus: 'confirmed', toStatus: 'delivered', quantity: 4, variantId: 'v-1' })
    ).resolves.toMatchObject({
      reservationDelta: -4,
      shipmentDelta: -4,
      createsDemand: false,
      releasesDemand: false,
      consumesReservation: true,
    });
  });

  it('treats production-to-void as releasing active demand and reservation', async () => {
    const service = new DemandService({});

    await expect(
      service.syncOrderTransition({ fromStatus: 'production', toStatus: 'void', quantity: 2, variantId: 'v-1' })
    ).resolves.toMatchObject({
      reservationDelta: -2,
      shipmentDelta: 0,
      createsDemand: false,
      releasesDemand: true,
      consumesReservation: false,
    });
  });
});
