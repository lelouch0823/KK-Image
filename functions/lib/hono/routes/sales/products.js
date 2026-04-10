import { Hono } from 'hono';
import { ProductRepository } from '../../../../repositories/ProductRepository.js';
import { ProductVariantRepository } from '../../../../repositories/ProductVariantRepository.js';
import { ProductDimensionRepository } from '../../../../repositories/ProductDimensionRepository.js';
import { VariantImageRepository } from '../../../../repositories/VariantImageRepository.js';
import { parseJsonArray } from '../../../../api/utils/json.js';
import { NotFoundError } from '../../errors.js';
import { withCache } from '../../middleware/cache.js';
import { parsePagination } from '../../_shared/route-helpers.js';
import { loadVariantReplenishmentMap } from '../_shared/variant-replenishment.js';

const app = new Hono();

app.onError((err, c) => {
  const statusCode = Number(err?.statusCode || 500);
  const code = err?.code || 'INTERNAL_ERROR';
  const error = err?.message || 'Internal Server Error';
  return c.json({ success: false, error, code }, statusCode);
});

/**
 * GET / - 销售端商品列表（只返回可售商品）
 */
app.get('/', withCache(20), async (c) => {
  const { env } = c;
  const { page, limit } = parsePagination(c, { limit: 12 });
  const search = c.req.query('search') || '';

  const repo = new ProductRepository(env.DB);
  const result = await repo.search({
    search: String(search || '').trim(),
    status: 'active',
    hasStock: 'in_stock',
    page,
    limit,
  });

  const items = (result.items || []).map((item) => {
    const images = parseJsonArray(item.images, []);
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
      page: result.page ?? page,
      limit: result.limit ?? limit,
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
  const dimensions = (await dimensionRepo.listByProduct(id))
    .filter((dimension) => dimension?.status !== 'archived')
    .map((dimension) => ({
      ...dimension,
      values: (dimension.values || []).filter((value) => value?.status !== 'archived'),
    }));
  const dimensionMap = Object.fromEntries(
    dimensions.map((dimension) => [dimension.id, dimension.name])
  );

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
        available_quantity: Number(variant.available_quantity ?? variant.available ?? variant.stock_quantity ?? 0),
      };
    })
  );
  product.dimensions = dimensions;
  product.dimension_map = dimensionMap;

  return c.json({ success: true, data: product });
});

export default app;
