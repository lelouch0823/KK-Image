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

const loadAllProductsForExport = async (repo, filters) => {
  const products = [];
  let page = 1;

  while (true) {
    const result = await repo.search({
      ...filters,
      page,
      limit: EXPORT_PAGE_LIMIT,
    });
    const items = Array.isArray(result?.items) ? result.items : [];
    products.push(...items);
    if (items.length < EXPORT_PAGE_LIMIT) {
      return products;
    }
    page += 1;
  }
};

app.get('/', async (c) => {
  const { env } = c;
  const format = String(c.req.query('format') || 'csv').trim().toLowerCase();

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
    const products = await loadAllProductsForExport(productRepo, filters);
    const detailedProducts = await Promise.all(
      products.map(async (product) => ({
        ...product,
        variants: await variantRepo.findByProductId(product.id),
        dimension_map: await dimensionRepo.getDimensionMap(product.id),
      }))
    );
    const rows = flattenProductsToVariantRows(detailedProducts);
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
    return c.json(
      { success: false, error: error?.message || 'Product export failed' },
      500
    );
  }
});

export default app;
