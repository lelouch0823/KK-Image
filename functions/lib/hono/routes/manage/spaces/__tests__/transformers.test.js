import { describe, expect, it, vi } from 'vitest';
import { projectSpaceTemplateData, transformSpaceDetail, transformSpaceListItem } from '../transformers.js';

vi.mock('../../../../_shared/utils.js', () => ({
  getShareUrl: vi.fn(() => 'https://share.example/space'),
  getFileUrl: vi.fn((path) => `https://cdn.example/${path}`),
}));

describe('space transformers', () => {
  it('prefers variant sku and variant image when space is bound to a variant', () => {
    const templateData = projectSpaceTemplateData({
      product_id: 'prod-1',
      variant_id: 'var-1',
      template_data: '{}',
      p_sku: 'SPU-001',
      pv_sku: 'SKU-RED-M',
      p_price: 199,
      p_specs: '{"material":"Cotton"}',
      pv_options_values: '{"材质":"Leather"}',
      p_images: '["product-1.jpg","product-2.jpg"]',
      display_image_id: 'variant-primary.jpg',
    });

    expect(templateData).toMatchObject({
      sku: 'SKU-RED-M',
      price: '199',
      material: 'Leather',
    });
    expect(templateData.images).toEqual([
      'variant-primary.jpg',
      'product-1.jpg',
      'product-2.jpg',
    ]);
  });

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
