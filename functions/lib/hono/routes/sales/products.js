import { Hono } from 'hono';
import { ProductRepository } from '../../../../repositories/ProductRepository.js';
import { ProductVariantRepository } from '../../../../repositories/ProductVariantRepository.js';
import { ProductDimensionRepository } from '../../../../repositories/ProductDimensionRepository.js';
import { VariantImageRepository } from '../../../../repositories/VariantImageRepository.js';
import { NotFoundError } from '../../errors.js';
import { withCache } from '../../middleware/cache.js';

const app = new Hono();

app.onError((err, c) => {
  const statusCode = Number(err?.statusCode || 500);
  const code = err?.code || 'INTERNAL_ERROR';
  const error = err?.message || 'Internal Server Error';
  return c.json({ success: false, error, code }, statusCode);
});

const parseJsonSafe = (value, fallback) => {
  if (!value) return fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
};

const loadVariantReplenishmentMap = async (db, variantIds = []) => {
  const normalizedIds = [...new Set((variantIds || []).filter(Boolean))];
  if (normalizedIds.length === 0) return new Map();

  const placeholders = normalizedIds.map(() => '?').join(',');
  const sql = `
    SELECT
      poi.variant_id,
      SUM(COALESCE(poi.quantity, 0)) AS replenishment_quantity,
      COUNT(DISTINCT poi.po_id) AS replenishment_po_count
    FROM purchase_order_items poi
    JOIN purchase_orders po ON po.id = poi.po_id
    WHERE poi.variant_id IN (${placeholders})
      AND po.status IN ('ordered', 'shipping')
    GROUP BY poi.variant_id
  `;

  const result = await db.prepare(sql).bind(...normalizedIds).all();
  const map = new Map();
  for (const row of result?.results || []) {
    map.set(row.variant_id, {
      replenishment_quantity: Number(row.replenishment_quantity || 0),
      replenishment_po_count: Number(row.replenishment_po_count || 0),
    });
  }
  return map;
};

/**
 * GET / - 销售端商品列表（只返回可售商品）
 */
app.get('/', withCache(20), async (c) => {
  const { env } = c;
  const { search = '', page = 1, limit = 12 } = c.req.query();

  const normalizedPage = Math.max(1, parseInt(page, 10) || 1);
  const normalizedLimit = Math.min(30, Math.max(1, parseInt(limit, 10) || 12));

  const repo = new ProductRepository(env.DB);
  const result = await repo.search({
    search: String(search || '').trim(),
    status: 'active',
    page: normalizedPage,
    limit: normalizedLimit,
  });

  const items = (result.items || []).map((item) => {
    const images = Array.isArray(item.images) ? item.images : parseJsonSafe(item.images, []);
    return {
      id: item.id,
      name: item.name,
      brand: item.brand || '',
      series: item.series || '',
      spu: item.spu || '',
      images,
      primaryImage: Array.isArray(images) && images.length > 0 ? images[0] : null,
    };
  });

  return c.json({
    success: true,
    data: items,
    meta: {
      total: Number(result.total || 0),
      page: normalizedPage,
      limit: normalizedLimit,
    },
  });
});

/**
 * GET /:id - 销售端商品详情（含可选变体）
 */
app.get('/:id', withCache(30), async (c) => {
  const { env } = c;
  const id = c.req.param('id');

  const repo = new ProductRepository(env.DB);
  const product = await repo.findById(id);
  if (!product || product.status !== 'active') {
    throw new NotFoundError('Product not found');
  }

  const variantRepo = new ProductVariantRepository(env.DB);
  const dimensionRepo = new ProductDimensionRepository(env.DB);
  const variantImageRepo = new VariantImageRepository(env.DB);

  const variants = (await variantRepo.findByProductId(id)).filter((variant) => variant.status === 'active');
  const replenishmentMap = await loadVariantReplenishmentMap(env.DB, variants.map((variant) => variant.id));
  const dimensions = await dimensionRepo.listByProduct(id);
  const dimensionMap = await dimensionRepo.getDimensionMap(id);

  product.variants = await Promise.all(
    variants.map(async (variant) => {
      const images = await variantImageRepo.listByVariant({
        productId: id,
        variantId: variant.id,
      });
      const primary = images.find((img) => Number(img.is_primary) === 1) || images[0] || null;
      const replenishment = replenishmentMap.get(variant.id) || {
        replenishment_quantity: 0,
        replenishment_po_count: 0,
      };
      return {
        ...variant,
        images,
        primaryImage: primary?.image_id || variant.image_id || null,
        replenishment_quantity: replenishment.replenishment_quantity,
        replenishment_po_count: replenishment.replenishment_po_count,
      };
    })
  );
  product.dimensions = dimensions;
  product.dimension_map = dimensionMap;

  return c.json({ success: true, data: product });
});

export default app;

