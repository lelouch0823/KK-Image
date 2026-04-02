import { describe, expect, it } from 'vitest';
import {
  buildCreatePayload,
  canSubmitOrderForm,
} from '../../../miniprogram/pages/form/controller';

describe('order form controller', () => {
  it('builds a create payload with fileIds and selected product binding', () => {
    const payload = buildCreatePayload({
      form: { name: 'Poster', brand: 'KK', quantity: 2, remark: '' },
      uploads: [
        { id: 'f-1', status: 'done' },
        { id: 'f-2', status: 'done' },
      ],
      boundProduct: { productId: 'p-1', variantId: 'v-1' },
    });

    expect(payload).toEqual(
      expect.objectContaining({
        name: 'Poster',
        quantity: 2,
        fileIds: ['f-1', 'f-2'],
        productId: 'p-1',
        variantId: 'v-1',
      })
    );
  });

  it('blocks submit while files are still uploading', () => {
    expect(canSubmitOrderForm([{ id: 'f-1', status: 'loading' }])).toBe(false);
  });
});
