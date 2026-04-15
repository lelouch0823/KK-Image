import { parseJsonObject } from '../api/utils/json.js';
import { chunkArray } from '../lib/db/batch.js';
import { ProductDimensionRepository } from './ProductDimensionRepository.js';
import {
  buildLivePurchaseItemSnapshot,
  normalizePurchaseItemSnapshotSpecs,
} from './purchase-order-snapshot.js';

const D1_MAX_IN_CLAUSE_SIZE = 100;

export async function loadOrderLineSnapshotMap({ db, items = [] }) {
  const orderIds = [
    ...new Set(items.map((item) => String(item?.pre_order_id || '').trim()).filter(Boolean)),
  ];
  const snapshotMap = new Map();
  if (orderIds.length === 0) return snapshotMap;

  for (const chunk of chunkArray(orderIds, D1_MAX_IN_CLAUSE_SIZE)) {
    const placeholders = chunk.map(() => '?').join(',');
    const { results = [] } = await db
      .prepare(
        `SELECT
          order_id,
          product_id,
          variant_id,
          MAX(snapshot_name) AS snapshot_name,
          MAX(snapshot_sku) AS snapshot_sku,
          MAX(snapshot_specs) AS snapshot_specs,
          MAX(snapshot_image) AS snapshot_image
         FROM order_lines
         WHERE order_id IN (${placeholders})
         GROUP BY order_id, product_id, variant_id`
      )
      .bind(...chunk)
      .all();

    for (const row of results) {
      snapshotMap.set(`${row.order_id}::${row.product_id || ''}::${row.variant_id || ''}`, row);
    }
  }

  return snapshotMap;
}

export async function loadLivePurchaseItemSnapshotMap({ db, items = [] }) {
  const variantIds = [
    ...new Set(items.map((item) => String(item?.variant_id || '').trim()).filter(Boolean)),
  ];
  const liveRows = [];
  if (variantIds.length === 0) return new Map();

  for (const chunk of chunkArray(variantIds, D1_MAX_IN_CLAUSE_SIZE)) {
    const placeholders = chunk.map(() => '?').join(',');
    const { results = [] } = await db
      .prepare(
        `SELECT
          p.id AS product_id,
          p.name AS product_name,
          p.brand AS product_brand,
          p.series AS product_series,
          p.images AS product_images,
          p.specifications AS product_specifications,
          v.id AS variant_id,
          v.sku AS variant_sku,
          v.options_values AS variant_options,
          v.image_id AS variant_image_id
         FROM product_variants v
         JOIN products p ON p.id = v.product_id
         WHERE v.id IN (${placeholders})`
      )
      .bind(...chunk)
      .all();
    liveRows.push(...results);
  }

  const productIds = [...new Set(liveRows.map((row) => row.product_id).filter(Boolean))];
  const dimensionRepo = new ProductDimensionRepository(db);
  const dimensionMapByProductId = new Map();
  for (const productId of productIds) {
    dimensionMapByProductId.set(productId, await dimensionRepo.getDimensionMap(productId));
  }

  const snapshotMap = new Map();
  for (const row of liveRows) {
    const product = {
      id: row.product_id,
      name: row.product_name,
      brand: row.product_brand,
      series: row.product_series,
      images: row.product_images,
      specifications: parseJsonObject(row.product_specifications, {}),
      dimension_map: dimensionMapByProductId.get(row.product_id) || {},
    };
    const variant = {
      id: row.variant_id,
      sku: row.variant_sku,
      options_values: row.variant_options,
      image_id: row.variant_image_id,
    };
    snapshotMap.set(
      `${row.product_id || ''}::${row.variant_id || ''}`,
      buildLivePurchaseItemSnapshot({ product, variant })
    );
  }

  return snapshotMap;
}

export async function hydratePurchaseItemSnapshots({ db, items = [] }) {
  const needsHydration = items.some(
    (item) =>
      !item?.snapshot_name
      || !item?.snapshot_sku
      || !item?.snapshot_specs
      || !item?.snapshot_image
  );
  if (!needsHydration) {
    return items.map((item) => ({
      ...item,
      snapshot_specs: normalizePurchaseItemSnapshotSpecs(item.snapshot_specs),
    }));
  }

  const orderLineSnapshotMap = await loadOrderLineSnapshotMap({ db, items });
  const liveSnapshotMap = await loadLivePurchaseItemSnapshotMap({ db, items });

  return items.map((item) => {
    const itemSnapshot = {
      snapshot_name: item.snapshot_name || null,
      snapshot_sku: item.snapshot_sku || null,
      snapshot_specs: item.snapshot_specs
        ? normalizePurchaseItemSnapshotSpecs(item.snapshot_specs)
        : null,
      snapshot_image: item.snapshot_image || null,
    };
    const orderLineSnapshot = orderLineSnapshotMap.get(
      `${item.pre_order_id || ''}::${item.product_id || ''}::${item.variant_id || ''}`
    ) || null;
    const liveSnapshot = liveSnapshotMap.get(
      `${item.product_id || ''}::${item.variant_id || ''}`
    ) || null;
    const fallback = orderLineSnapshot || liveSnapshot || {};

    return {
      ...item,
      snapshot_name: itemSnapshot.snapshot_name || fallback.snapshot_name || null,
      snapshot_sku: itemSnapshot.snapshot_sku || fallback.snapshot_sku || null,
      snapshot_specs: itemSnapshot.snapshot_specs || fallback.snapshot_specs || null,
      snapshot_image: itemSnapshot.snapshot_image || fallback.snapshot_image || null,
    };
  });
}
