import { describe, expect, it } from 'vitest';
import {
  buildFormPrefillState,
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

  it('hydrates duplicate prefill into form data binding and remote files', () => {
    const state = buildFormPrefillState(
      {
        name: '',
        brand: '',
        series: '',
        sku: '',
        size: '',
        color: '',
        material: '',
        remark: '',
        deadline: '',
        quantity: 1,
      },
      {
        name: 'Poster',
        quantity: 3,
        productId: 'p-1',
        variantId: 'v-1',
        brand: 'KK',
        files: [
          {
            id: 'f-1',
            url: '/file/a.png',
            name: 'poster.png',
            type: 'image',
          },
        ],
      }
    );

    expect(state).toMatchObject({
      form: {
        name: 'Poster',
        quantity: 3,
        brand: 'KK',
      },
      boundProduct: {
        productId: 'p-1',
        variantId: 'v-1',
        name: 'Poster',
      },
      fileList: [
        {
          id: 'f-1',
          url: '/file/a.png',
          name: 'poster.png',
          type: 'image',
          status: 'done',
          isLocal: false,
        },
      ],
    });
  });
});
