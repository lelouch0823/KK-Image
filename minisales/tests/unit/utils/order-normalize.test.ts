import { describe, expect, it } from 'vitest';
import {
  normalizeSalesOrderDetail,
  normalizeSalesOrderSummary,
} from '../../../miniprogram/utils/normalize/order';

describe('order normalizers', () => {
  it('normalizes order summaries with currentData and display-status fallbacks', () => {
    const summary = normalizeSalesOrderSummary({
      id: 'o-1',
      orderNo: 'SO-001',
      currentData: { name: 'Poster' },
      procurementStatus: 'ordered',
      displayStatus: 'partially_received',
      quantity: 2,
      is_unread: 1,
      updatedAt: 100,
    });

    expect(summary).toEqual(
      expect.objectContaining({
        id: 'o-1',
        title: 'Poster',
        status: 'partially_received',
        quantity: 2,
        hasNewFeedback: true,
      })
    );
  });

  it('normalizes order detail into header lines files and timeline groups', () => {
    const detail = normalizeSalesOrderDetail({
      id: 'o-1',
      orderNo: 'SO-001',
      quantity: 3,
      currentData: { name: 'Poster' },
      lines: [
        {
          id: 'l-1',
          snapshot_name: 'Poster',
          ordered_qty: 3,
          display_status: 'fully_procured',
        },
      ],
      files: [{ id: 'f-1', url: '/file/a.png' }],
      timeline: [{ id: 't-1', actionType: 'created', createdAt: 1 }],
    });

    expect(detail.header.title).toBe('Poster');
    expect(detail.lines[0].status).toBe('fully_procured');
    expect(detail.timeline).toHaveLength(1);
  });

  it('accepts already-camelized order lines from backend helpers', () => {
    const detail = normalizeSalesOrderDetail({
      id: 'o-2',
      orderNo: 'SO-002',
      lines: [
        {
          id: 'l-2',
          snapshotName: 'Lamp',
          orderedQuantity: 1,
          displayStatus: 'unprocured',
        },
      ],
    });

    expect(detail.lines[0]).toEqual(
      expect.objectContaining({
        title: 'Lamp',
        quantity: 1,
        status: 'unprocured',
      })
    );
  });
});
