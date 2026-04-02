import { describe, expect, it } from 'vitest';
import {
  buildDuplicatePrefill,
  buildOrderDetailViewModel,
} from '../../../miniprogram/pages/detail/controller';

describe('order detail controller', () => {
  it('projects detail data into header lines files and timeline sections', () => {
    const model = buildOrderDetailViewModel({
      id: 'o-1',
      orderNo: 'SO-001',
      status: 'pending',
      quantity: 2,
      currentData: { name: 'Poster' },
      lines: [{ id: 'l-1', snapshot_name: 'Poster', ordered_qty: 2, display_status: 'partially_received' }],
      files: [{ id: 'f-1', url: '/file/a.png' }],
      timeline: [{ id: 't-1', actionType: 'created', createdAt: 1 }],
    });

    expect(model.summary.title).toBe('Poster');
    expect(model.lines[0].status).toBe('partially_received');
    expect(model.timeline[0].id).toBe('t-1');
  });

  it('builds duplicate prefill from top-level quantity and current binding ids', () => {
    const prefill = buildDuplicatePrefill({
      quantity: 3,
      currentData: { name: 'Poster' },
      productId: 'p-1',
      variantId: 'v-1',
    });

    expect(prefill).toMatchObject({
      name: 'Poster',
      quantity: 3,
      productId: 'p-1',
      variantId: 'v-1',
    });
  });
});
