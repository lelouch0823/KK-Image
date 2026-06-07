import { Hono } from 'hono';
import { ProductRepository } from '../../../../../repositories/ProductRepository.js';
import { ProductVariantRepository } from '../../../../../repositories/ProductVariantRepository.js';
import { ProductDimensionRepository } from '../../../../../repositories/ProductDimensionRepository.js';
import {
  buildCsvContent,
  EXPORT_COLUMNS,
  flattenProductsToVariantRows,
  normalizeProductExportFilters,
} from '../../../../../../src/components/product/export/export-utils.js';

const app = new Hono();
const EXPORT_PAGE_LIMIT = 100;
const MAX_EXPORT_PAGES = 100; // 最多导出 10000 条 (100页 * 100条/页)

const loadAllProductsForExport = async (repo, filters) => {
  const products = [];
  let page = 1;

  while (page <= MAX_EXPORT_PAGES) {
    const result = await repo.search(
      {
        ...filters,
        page,
        limit: EXPORT_PAGE_LIMIT,
      },
      { includeFilters: false }
    );
    const items = Array.isArray(result?.items) ? result.items : [];
    products.push(...items);
    if (items.length < EXPORT_PAGE_LIMIT) {
      return products;
    }
    page += 1;
  }

  // 达到最大页数限制，返回已加载的数据
  console.warn(
    `[ProductExport] Reached max export pages (${MAX_EXPORT_PAGES}), returning partial results`
  );
  return products;
};

app.get('/', async (c) => {
  const { env } = c;
  const format = String(c.req.query('format') || 'csv')
    .trim()
    .toLowerCase();

  if (format !== 'csv') {
    return c.json({ success: false, error: 'Only CSV format is supported currently' }, 400);
  }

  try {
    const filters = normalizeProductExportFilters('filtered', {
      search: c.req.query('search'),
      status: c.req.query('status'),
      brand: c.req.query('brand'),
      category: c.req.query('category'),
      hasStock: c.req.query('hasStock'),
      sortBy: c.req.query('sortBy'),
      sortOrder: c.req.query('sortOrder'),
    });

    const productRepo = new ProductRepository(env.DB);
    const variantRepo = new ProductVariantRepository(env.DB);
    const dimensionRepo = new ProductDimensionRepository(env.DB);

    // 1. 加载所有商品（已有分页保护）
    const products = await loadAllProductsForExport(productRepo, filters);

    // 2. 批量查询 variants 和 dimensions（避免 N+1 查询）
    const productIds = products.map((p) => p.id);
    const [variantsMap, dimensionsMap] = await Promise.all([
      variantRepo.findByProductIds(productIds),
      dimensionRepo.getDimensionMapByProductIds
        ? dimensionRepo.getDimensionMapByProductIds(productIds)
        : Promise.resolve(new Map()),
    ]);

    // 3. 组装详细数据（内存中完成，无额外查询）
    const detailedProducts = products.map((product) => ({
      ...product,
      variants: variantsMap.get(product.id) || [],
      dimension_map: dimensionsMap.get(product.id) || {},
    }));

    const rows = flattenProductsToVariantRows(detailedProducts, filters);
    const csv = buildCsvContent(rows, EXPORT_COLUMNS);
    const date = new Date().toISOString().slice(0, 10);

    return new Response(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="products_variants_${date}.csv"`,
        'Cache-Control': 'no-cache',
      },
    });
  } catch (error) {
    console.error('Product export failed:', error);
    return c.json({ success: false, error: error?.message || 'Product export failed' }, 500);
  }
});

export default app;
