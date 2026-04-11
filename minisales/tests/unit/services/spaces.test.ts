import { describe, expect, it, vi } from 'vitest';
import {
  getSalesSpaceDetail,
  loadSalesSpaces,
} from '../../../miniprogram/services/sales/spaces';

describe('sales spaces service', () => {
  it('normalizes snake_case cover refs and nested file payloads', async () => {
    const request = vi
      .fn()
      .mockResolvedValueOnce({
        success: true,
        data: [
          {
            id: 'space-1',
            name: '新品空间',
            file_count: 2,
            cover_url: 'cover-image',
            product_id: 'product-1',
            variant_id: 'variant-1',
          },
        ],
        error: null,
        code: null,
        status: 200,
        payload: { success: true },
      })
      .mockResolvedValueOnce({
        success: true,
        data: {
          id: 'space-1',
          files: [
            {
              id: 'file-1',
              storage_key: 'gallery/file-1',
              mime_type: 'image/png',
            },
          ],
          subspaces: [
            {
              id: 'sub-1',
              name: '子空间',
              cover_url: 'sub-cover',
            },
          ],
        },
        error: null,
        code: null,
        status: 200,
        payload: { success: true },
      });

    const listResult = await loadSalesSpaces({ accessToken: 'sales-token' }, request);
    const detailResult = await getSalesSpaceDetail(
      { accessToken: 'sales-token', spaceId: 'space-1' },
      request
    );

    expect(request).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        path: '/api/sales/sales-token/spaces',
        method: 'GET',
      })
    );
    expect(request).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        path: '/api/sales/sales-token/spaces/space-1',
        method: 'GET',
      })
    );
    expect(listResult.data).toEqual([
      expect.objectContaining({
        id: 'space-1',
        coverUrl: '/file/cover-image',
        fileCount: 2,
        productId: 'product-1',
        variantId: 'variant-1',
      }),
    ]);
    expect(detailResult.data).toEqual(
      expect.objectContaining({
        files: [
          expect.objectContaining({
            id: 'file-1',
            url: '/file/gallery/file-1',
            mimeType: 'image/png',
          }),
        ],
        subspaces: [
          expect.objectContaining({
            id: 'sub-1',
            coverUrl: '/file/sub-cover',
          }),
        ],
      })
    );
  });

  it('hydrates product template images into preview files when detail payload has no bound files', async () => {
    const request = vi.fn().mockResolvedValue({
      success: true,
      data: {
        id: 'space-product-1',
        template: 'product',
        template_data: {
          images: ['variant-main.jpg', '/file/product-side.jpg'],
        },
        files: [],
      },
      error: null,
      code: null,
      status: 200,
      payload: { success: true },
    });

    const detailResult = await getSalesSpaceDetail(
      { accessToken: 'sales-token', spaceId: 'space-product-1' },
      request
    );

    expect(detailResult.data).toEqual(
      expect.objectContaining({
        files: [
          expect.objectContaining({
            id: 'template-image-0',
            url: '/file/variant-main.jpg',
            mimeType: 'image/jpeg',
          }),
          expect.objectContaining({
            id: 'template-image-1',
            url: '/file/product-side.jpg',
            mimeType: 'image/jpeg',
          }),
        ],
      })
    );
  });

  it('hydrates collection subspace cover from template images when no explicit cover exists', async () => {
    const request = vi.fn().mockResolvedValue({
      success: true,
      data: {
        id: 'space-collection-1',
        template: 'collection',
        subspaces: [
          {
            id: 'sub-1',
            name: '子空间 1',
            template: 'product',
            template_data: {
              images: ['variant-main.jpg'],
            },
            file_count: 0,
          },
        ],
      },
      error: null,
      code: null,
      status: 200,
      payload: { success: true },
    });

    const detailResult = await getSalesSpaceDetail(
      { accessToken: 'sales-token', spaceId: 'space-collection-1' },
      request
    );

    expect(detailResult.data).toEqual(
      expect.objectContaining({
        subspaces: [
          expect.objectContaining({
            id: 'sub-1',
            coverUrl: '/file/variant-main.jpg',
          }),
        ],
      })
    );
  });
});
