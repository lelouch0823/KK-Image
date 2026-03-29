import { describe, expect, it, vi } from 'vitest';
import { transformSpaceDetail, transformSpaceListItem } from '../transformers.js';

vi.mock('../../../../_shared/utils.js', () => ({
  getShareUrl: vi.fn(() => 'https://share.example/space'),
  getFileUrl: vi.fn((path) => `https://cdn.example/${path}`),
}));

describe('space transformers', () => {
  it('projects variantId in list and detail payloads', () => {
    const space = {
      id: 'space-1',
      name: 'Space 1',
      description: 'desc',
      is_public: 1,
      password: null,
      share_token: 'share-1',
      share_mode: 'selected',
      file_count: 2,
      expires_at: 1710000000000,
      template: 'default',
      template_data: '{}',
      cover_file_id: 'file-cover',
      cover_storage_key: 'covers/cover.png',
      view_count: 7,
      product_id: 'prod-1',
      variant_id: 'var-1',
      created_at: 1711000000000,
      updated_at: 1711000001000,
    };

    expect(transformSpaceListItem(space)).toMatchObject({
      productId: 'prod-1',
      variantId: 'var-1',
      createdAt: 1711000000000,
    });

    expect(transformSpaceDetail(space, [])).toMatchObject({
      productId: 'prod-1',
      variantId: 'var-1',
      createdAt: 1711000000000,
    });
  });
});
