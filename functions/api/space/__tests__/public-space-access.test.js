import { beforeEach, describe, expect, it, vi } from 'vitest';
import { onRequestGet, onRequestPost } from '../[token].js';

describe('public space access api', () => {
  const baseSpaceRecord = {
    id: 'space-1',
    share_token: 'share-token',
    password: 'secret',
    name: '受保护空间',
    template: 'product',
    description: '',
    view_count: 3,
    cover_file_id: null,
    p_images: '[]',
    is_public: 1,
    expires_at: null,
  };

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('records access log and increments view count after password verification succeeds', async () => {
    const spaceRecord = { ...baseSpaceRecord };
    const first = vi.fn().mockResolvedValue(spaceRecord);
    const all = vi.fn().mockResolvedValue({ results: [] });
    const batch = vi.fn().mockResolvedValue([]);

    const prepare = vi.fn((sql) => {
      if (sql.includes('WHERE s.share_token = ?')) {
        return { bind: () => ({ first }) };
      }
      if (sql.includes('FROM space_files sf')) {
        return { bind: () => ({ all }) };
      }
      if (sql.includes('WHERE s.parent_id = ? AND s.is_public = 1')) {
        return { bind: () => ({ all }) };
      }
      if (sql.includes('INSERT INTO space_access_logs')) {
        return { bind: (...args) => ({ sql, args }) };
      }
      if (sql.includes('UPDATE spaces SET view_count = view_count + 1')) {
        return { bind: (...args) => ({ sql, args }) };
      }
      throw new Error(`Unexpected SQL: ${sql}`);
    });

    const response = await onRequestPost({
      env: { DB: { prepare, batch } },
      params: { token: 'share-token' },
      request: new Request('http://localhost/api/space/share-token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'vitest',
          Referer: 'http://localhost/from',
          'CF-Connecting-IP': '127.0.0.1',
        },
        body: JSON.stringify({ password: 'secret' }),
      }),
    });

    expect(response.status).toBe(200);
    expect(batch).toHaveBeenCalledTimes(1);
    const payload = await response.json();
    expect(payload.success).toBe(true);
    expect(payload.data.viewCount).toBe(4);
  });

  it('rejects password access to private spaces', async () => {
    const first = vi.fn().mockResolvedValue({ ...baseSpaceRecord, is_public: 0 });
    const batch = vi.fn();
    const prepare = vi.fn((sql) => {
      if (sql.includes('WHERE s.share_token = ?')) {
        return { bind: () => ({ first }) };
      }
      throw new Error(`Unexpected SQL: ${sql}`);
    });

    const response = await onRequestPost({
      env: { DB: { prepare, batch } },
      params: { token: 'share-token' },
      request: new Request('http://localhost/api/space/share-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: 'secret' }),
      }),
    });

    expect(response.status).toBe(403);
    expect(batch).not.toHaveBeenCalled();
  });

  it('rejects password access to expired spaces', async () => {
    const first = vi.fn().mockResolvedValue({
      ...baseSpaceRecord,
      expires_at: Date.now() - 1000,
    });
    const batch = vi.fn();
    const prepare = vi.fn((sql) => {
      if (sql.includes('WHERE s.share_token = ?')) {
        return { bind: () => ({ first }) };
      }
      throw new Error(`Unexpected SQL: ${sql}`);
    });

    const response = await onRequestPost({
      env: { DB: { prepare, batch } },
      params: { token: 'share-token' },
      request: new Request('http://localhost/api/space/share-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: 'secret' }),
      }),
    });

    expect(response.status).toBe(410);
    expect(batch).not.toHaveBeenCalled();
  });

  it('hydrates public collection subspace cover and file count from template images', async () => {
    const first = vi.fn().mockResolvedValue({
      ...baseSpaceRecord,
      password: null,
      template: 'collection',
    });
    const filesAll = vi.fn().mockResolvedValue({ results: [] });
    const subspacesAll = vi.fn().mockResolvedValue({
      results: [
        {
          id: 'sub-1',
          name: '商品子空间',
          template: 'product',
          description: '',
          template_data: '{}',
          product_id: 'product-1',
          file_count: 0,
          cover_storage_key: null,
          p_sku: 'SKU-1',
          p_brand: 'KK',
          p_series: 'A1',
          p_price: 99,
          p_specs: '{}',
          p_images: '["variant-main.jpg"]',
        },
      ],
    });
    const batch = vi.fn().mockResolvedValue([]);

    const prepare = vi.fn((sql) => {
      if (sql.includes('WHERE s.share_token = ?')) {
        return { bind: () => ({ first }) };
      }
      if (sql.includes('FROM space_files sf')) {
        return { bind: () => ({ all: filesAll }) };
      }
      if (sql.includes('WHERE s.parent_id = ? AND s.is_public = 1')) {
        return { bind: () => ({ all: subspacesAll }) };
      }
      if (sql.includes('INSERT INTO space_access_logs')) {
        return { bind: (...args) => ({ sql, args }) };
      }
      if (sql.includes('UPDATE spaces SET view_count = view_count + 1')) {
        return { bind: (...args) => ({ sql, args }) };
      }
      throw new Error(`Unexpected SQL: ${sql}`);
    });

    const response = await onRequestGet({
      env: { DB: { prepare, batch } },
      params: { token: 'share-token' },
      request: new Request('http://localhost/api/space/share-token'),
    });

    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload.success).toBe(true);
    expect(payload.data.subspaces).toEqual([
      expect.objectContaining({
        id: 'sub-1',
        coverImage: '/file/variant-main.jpg',
        fileCount: 1,
      }),
    ]);
  });

  it('projects variant sku, material and image for public product spaces and collection subspaces', async () => {
    const first = vi.fn().mockResolvedValue({
      ...baseSpaceRecord,
      password: null,
      template: 'product',
      product_id: 'product-1',
      variant_id: 'variant-1',
      p_sku: 'SPU-001',
      pv_sku: 'SKU-BLACK-L',
      p_price: 199,
      p_specs: '{"material":"Cotton"}',
      pv_options_values: '{"材质":"Leather"}',
      p_images: '["product-main.jpg","product-side.jpg"]',
      display_image_id: 'variant-primary.jpg',
    });
    const filesAll = vi.fn().mockResolvedValue({ results: [] });
    const subspacesAll = vi.fn().mockResolvedValue({
      results: [
        {
          id: 'sub-variant-1',
          name: '变体子空间',
          template: 'product',
          description: '',
          template_data: '{}',
          product_id: 'product-1',
          variant_id: 'variant-1',
          file_count: 0,
          cover_storage_key: null,
          p_sku: 'SPU-001',
          pv_sku: 'SKU-BLACK-L',
          p_price: 199,
          p_specs: '{"material":"Cotton"}',
          pv_options_values: '{"材质":"Leather"}',
          p_images: '["product-main.jpg","product-side.jpg"]',
          display_image_id: 'variant-primary.jpg',
        },
      ],
    });
    const batch = vi.fn().mockResolvedValue([]);

    const prepare = vi.fn((sql) => {
      if (sql.includes('WHERE s.share_token = ?')) {
        expect(sql).toContain('LEFT JOIN product_variants pv');
        expect(sql).toContain('pv.sku as pv_sku');
        expect(sql).toContain('pv.options_values as pv_options_values');
        expect(sql).toContain('display_image_id');
        return { bind: () => ({ first }) };
      }
      if (sql.includes('FROM space_files sf')) {
        return { bind: () => ({ all: filesAll }) };
      }
      if (sql.includes('WHERE s.parent_id = ? AND s.is_public = 1')) {
        expect(sql).toContain('LEFT JOIN product_variants pv');
        expect(sql).toContain('pv.sku as pv_sku');
        expect(sql).toContain('pv.options_values as pv_options_values');
        expect(sql).toContain('display_image_id');
        return { bind: () => ({ all: subspacesAll }) };
      }
      if (sql.includes('INSERT INTO space_access_logs')) {
        return { bind: (...args) => ({ sql, args }) };
      }
      if (sql.includes('UPDATE spaces SET view_count = view_count + 1')) {
        return { bind: (...args) => ({ sql, args }) };
      }
      throw new Error(`Unexpected SQL: ${sql}`);
    });

    const response = await onRequestGet({
      env: { DB: { prepare, batch } },
      params: { token: 'share-token' },
      request: new Request('http://localhost/api/space/share-token'),
    });

    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload.success).toBe(true);
    expect(payload.data.templateData).toEqual(
      expect.objectContaining({
        sku: 'SKU-BLACK-L',
        material: 'Leather',
        images: ['variant-primary.jpg', 'product-main.jpg', 'product-side.jpg'],
      })
    );
    expect(payload.data.subspaces).toEqual([
      expect.objectContaining({
        id: 'sub-variant-1',
        templateData: expect.objectContaining({
          sku: 'SKU-BLACK-L',
          material: 'Leather',
          images: ['variant-primary.jpg', 'product-main.jpg', 'product-side.jpg'],
        }),
      }),
    ]);
  });

  it('excludes expired public subspaces from collection payloads', async () => {
    const first = vi.fn().mockResolvedValue({
      ...baseSpaceRecord,
      password: null,
      template: 'collection',
    });
    const filesAll = vi.fn().mockResolvedValue({ results: [] });
    const subspacesAll = vi.fn().mockResolvedValue({
      results: [
        {
          id: 'sub-active-1',
          name: '有效子空间',
          template: 'gallery',
          description: '',
          template_data: '{}',
          product_id: null,
          variant_id: null,
          file_count: 1,
          cover_storage_key: 'covers/active.jpg',
          expires_at: null,
        },
        {
          id: 'sub-expired-1',
          name: '过期子空间',
          template: 'gallery',
          description: '',
          template_data: '{}',
          product_id: null,
          variant_id: null,
          file_count: 1,
          cover_storage_key: 'covers/expired.jpg',
          expires_at: Date.now() - 1000,
        },
      ],
    });
    const batch = vi.fn().mockResolvedValue([]);

    const prepare = vi.fn((sql) => {
      if (sql.includes('WHERE s.share_token = ?')) {
        return { bind: () => ({ first }) };
      }
      if (sql.includes('FROM space_files sf')) {
        return { bind: () => ({ all: filesAll }) };
      }
      if (sql.includes('WHERE s.parent_id = ? AND s.is_public = 1')) {
        return { bind: () => ({ all: subspacesAll }) };
      }
      if (sql.includes('INSERT INTO space_access_logs')) {
        return { bind: (...args) => ({ sql, args }) };
      }
      if (sql.includes('UPDATE spaces SET view_count = view_count + 1')) {
        return { bind: (...args) => ({ sql, args }) };
      }
      throw new Error(`Unexpected SQL: ${sql}`);
    });

    const response = await onRequestGet({
      env: { DB: { prepare, batch } },
      params: { token: 'share-token' },
      request: new Request('http://localhost/api/space/share-token'),
    });

    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload.success).toBe(true);
    expect(payload.data.subspaces).toEqual([
      expect.objectContaining({
        id: 'sub-active-1',
      }),
    ]);
  });

  it('includes variant primary image in public product files, cover and file count', async () => {
    const first = vi.fn().mockResolvedValue({
      ...baseSpaceRecord,
      password: null,
      template: 'product',
      product_id: 'product-1',
      variant_id: 'variant-1',
      p_sku: 'SPU-001',
      pv_sku: 'SKU-BLACK-L',
      p_price: 199,
      p_specs: '{"material":"Cotton"}',
      pv_options_values: '{"材质":"Leather"}',
      p_images: '["product-main.jpg","product-side.jpg"]',
      display_image_id: 'variant-primary.jpg',
      cover_file_id: null,
    });
    const filesAll = vi.fn().mockResolvedValue({ results: [] });
    const subspacesAll = vi.fn().mockResolvedValue({ results: [] });
    const batch = vi.fn().mockResolvedValue([]);

    const prepare = vi.fn((sql) => {
      if (sql.includes('WHERE s.share_token = ?')) {
        return { bind: () => ({ first }) };
      }
      if (sql.includes('FROM space_files sf')) {
        return { bind: () => ({ all: filesAll }) };
      }
      if (sql.includes('WHERE s.parent_id = ? AND s.is_public = 1')) {
        return { bind: () => ({ all: subspacesAll }) };
      }
      if (sql.includes('INSERT INTO space_access_logs')) {
        return { bind: (...args) => ({ sql, args }) };
      }
      if (sql.includes('UPDATE spaces SET view_count = view_count + 1')) {
        return { bind: (...args) => ({ sql, args }) };
      }
      throw new Error(`Unexpected SQL: ${sql}`);
    });

    const response = await onRequestGet({
      env: { DB: { prepare, batch } },
      params: { token: 'share-token' },
      request: new Request('http://localhost/api/space/share-token'),
    });

    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload.success).toBe(true);
    expect(payload.data.coverImage).toBe('/file/variant-primary.jpg');
    expect(payload.data.fileCount).toBe(3);
    expect(payload.data.files).toEqual([
      expect.objectContaining({ url: '/file/variant-primary.jpg' }),
      expect.objectContaining({ url: '/file/product-main.jpg' }),
      expect.objectContaining({ url: '/file/product-side.jpg' }),
    ]);
  });
});
