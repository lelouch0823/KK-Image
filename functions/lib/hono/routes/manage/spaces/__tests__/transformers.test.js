import { describe, expect, it, vi } from 'vitest';
import {
  projectSpaceTemplateData,
  resolveSpaceBindingState,
  transformSpaceDetail,
  transformSpaceListItem,
} from '../transformers.js';

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
    expect(templateData.images).toEqual(['variant-primary.jpg', 'product-1.jpg', 'product-2.jpg']);
  });

  it('maps variant dimension ids through dimension_map before applying semantic option aliases', () => {
    const templateData = projectSpaceTemplateData({
      product_id: 'prod-1',
      variant_id: 'var-1',
      template_data: '{}',
      p_sku: 'SPU-001',
      pv_sku: 'SKU-LEATHER',
      p_price: 199,
      p_specs: '{"material":"Cotton"}',
      p_dimension_map: '{"dim-material":"材质"}',
      pv_options_values: '{"dim-material":"Leather"}',
      p_images: '["product-1.jpg"]',
      display_image_id: 'variant-primary.jpg',
    });

    expect(templateData).toMatchObject({
      sku: 'SKU-LEATHER',
      material: 'Leather',
    });
  });

  it('falls back to stored template data when bound product or variant is archived', () => {
    const templateData = projectSpaceTemplateData({
      product_id: 'prod-1',
      variant_id: 'var-1',
      template_data: JSON.stringify({
        sku: 'SNAPSHOT-SKU',
        material: 'Snapshot Material',
        images: ['snapshot-cover.jpg'],
      }),
      p_status: 'archived',
      pv_status: 'archived',
      p_sku: 'LIVE-SPU',
      pv_sku: 'LIVE-SKU',
      p_price: 199,
      p_specs: '{"material":"Live Material"}',
      pv_options_values: '{"材质":"Live Leather"}',
      p_images: '["live-1.jpg","live-2.jpg"]',
      display_image_id: 'live-primary.jpg',
    });

    expect(templateData).toEqual({
      sku: 'SNAPSHOT-SKU',
      material: 'Snapshot Material',
      images: ['snapshot-cover.jpg'],
    });
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
      p_bound_id: 'prod-1',
      pv_bound_id: 'var-1',
      created_at: 1711000000000,
      updated_at: 1711000001000,
    };

    expect(transformSpaceListItem(space)).toMatchObject({
      productId: 'prod-1',
      variantId: 'var-1',
      bindingState: 'active',
      bindingUsesSnapshot: false,
      createdAt: 1711000000000,
    });

    expect(transformSpaceDetail(space, [])).toMatchObject({
      productId: 'prod-1',
      variantId: 'var-1',
      bindingState: 'active',
      bindingUsesSnapshot: false,
      createdAt: 1711000000000,
    });
  });

  it('marks archived or missing bindings so management readers can surface fallback state', () => {
    expect(
      resolveSpaceBindingState({
        product_id: 'prod-1',
        variant_id: 'var-1',
        p_bound_id: 'prod-1',
        pv_bound_id: 'var-1',
        p_status: 'archived',
        pv_status: 'active',
      })
    ).toBe('archived_product');

    expect(
      resolveSpaceBindingState({
        product_id: 'prod-1',
        variant_id: 'var-1',
        p_bound_id: 'prod-1',
        pv_bound_id: null,
        p_status: 'active',
      })
    ).toBe('missing_variant');

    expect(
      transformSpaceDetail(
        {
          id: 'space-2',
          name: 'Space 2',
          template: 'product',
          template_data: '{}',
          product_id: 'prod-1',
          variant_id: 'var-1',
          p_bound_id: 'prod-1',
          pv_bound_id: null,
          p_status: 'active',
        },
        []
      )
    ).toMatchObject({
      bindingState: 'missing_variant',
      bindingUsesSnapshot: true,
    });
  });
});
