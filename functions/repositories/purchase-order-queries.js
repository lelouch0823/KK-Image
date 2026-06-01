import { parseRepoPagination } from '../api/utils/pagination.js';
import {
  normalizePurchaseOrderProgress,
  summarizePurchaseOrderItems,
  toNumber,
} from './purchase-order-read-model.js';
import { mapPurchaseOrderSnapshotFields } from './purchase-order-snapshot.js';

export async function findPurchaseOrderDetail({ db, id }) {
  const po = await db.prepare(`SELECT * FROM purchase_orders WHERE id = ?`).bind(id).first();
  if (!po) return null;

  // items 和 receipts 查询无依赖关系，并行执行减少延迟
  const [itemsResult, receiptsResult] = await Promise.all([
    db.prepare(`
    SELECT
      poi.*,
      p.name AS product_name,
      p.spu AS product_sku,
      p.brand AS product_brand,
      p.images AS product_images,
      p.specifications AS product_specifications,
      v.sku AS variant_sku,
      v.options_values AS variant_options,
      o.order_no AS customer_order_no,
      COALESCE(poi.snapshot_name, ols.snapshot_name) AS snapshot_name,
      COALESCE(poi.snapshot_sku, ols.snapshot_sku) AS snapshot_sku,
      COALESCE(poi.snapshot_specs, ols.snapshot_specs) AS snapshot_specs,
      COALESCE(poi.snapshot_image, ols.snapshot_image) AS snapshot_image,
      COALESCE(json_extract(poi.snapshot_specs, '$.brand'), json_extract(ols.snapshot_specs, '$.brand')) AS snapshot_brand,
      COALESCE(pr.receipt_count, 0) AS receipt_count,
      pr.last_received_at AS last_received_at
    FROM purchase_order_items poi
    LEFT JOIN products p ON poi.product_id = p.id
    LEFT JOIN product_variants v ON poi.variant_id = v.id
    LEFT JOIN orders o ON poi.pre_order_id = o.id
    LEFT JOIN (
      SELECT
        order_id,
        product_id,
        variant_id,
        MAX(snapshot_name) AS snapshot_name,
        MAX(snapshot_sku) AS snapshot_sku,
        MAX(snapshot_specs) AS snapshot_specs,
        MAX(snapshot_image) AS snapshot_image
      FROM order_lines
      GROUP BY order_id, product_id, variant_id
    ) ols ON ols.order_id = poi.pre_order_id
      AND ols.product_id = poi.product_id
      AND ols.variant_id = poi.variant_id
    LEFT JOIN (
      SELECT
        purchase_order_item_id,
        COUNT(*) AS receipt_count,
        MAX(received_at) AS last_received_at
      FROM purchase_receipts
      GROUP BY purchase_order_item_id
    ) pr ON pr.purchase_order_item_id = poi.id
    WHERE poi.po_id = ?
    ORDER BY poi.created_at ASC
  `).bind(id).all(),
    db.prepare(`
    SELECT
      pr.*,
      p.name AS product_name,
      p.brand AS product_brand,
      p.spu AS product_sku,
      p.images AS product_images,
      v.sku AS variant_sku,
      v.options_values AS variant_options,
      COALESCE(poi_item.snapshot_name, ol.snapshot_name) AS snapshot_name,
      COALESCE(poi_item.snapshot_sku, ol.snapshot_sku) AS snapshot_sku,
      COALESCE(poi_item.snapshot_specs, ol.snapshot_specs) AS snapshot_specs,
      COALESCE(poi_item.snapshot_image, ol.snapshot_image) AS snapshot_image,
      COALESCE(json_extract(poi_item.snapshot_specs, '$.brand'), json_extract(ol.snapshot_specs, '$.brand')) AS snapshot_brand,
      COALESCE(rr.reversed_qty, 0) AS reversed_qty,
      COALESCE(rr.reversal_count, 0) AS reversal_count,
      rr.last_reversed_at AS last_reversed_at
    FROM purchase_receipts pr
    LEFT JOIN products p ON p.id = pr.product_id
    LEFT JOIN product_variants v ON v.id = pr.variant_id
    LEFT JOIN purchase_order_items poi_item ON poi_item.id = pr.purchase_order_item_id
    LEFT JOIN order_lines ol ON ol.id = pr.order_line_id
    LEFT JOIN (
      SELECT
        original_receipt_id,
        COALESCE(SUM(reversal_qty), 0) AS reversed_qty,
        COUNT(*) AS reversal_count,
        MAX(created_at) AS last_reversed_at
      FROM purchase_receipt_reversals
      GROUP BY original_receipt_id
    ) rr ON rr.original_receipt_id = pr.id
    WHERE pr.purchase_order_id = ?
    ORDER BY pr.received_at DESC, pr.created_at DESC
  `).bind(id).all(),
  ]);

  const items = itemsResult?.results || [];
  const receipts = receiptsResult?.results || [];

  const poItems = items.map((item) => {
    const mapped = mapPurchaseOrderSnapshotFields(item);
    return {
      ...mapped,
      quantity: toNumber(item.quantity),
      received_qty: toNumber(item.received_qty),
      cancelled_qty: toNumber(item.cancelled_qty),
      receipt_count: toNumber(item.receipt_count),
    };
  });

  const receiptRows = receipts.map((receipt) => {
    const mapped = mapPurchaseOrderSnapshotFields(receipt);
    const normalizedReceipt = normalizePurchaseOrderProgress({
      ...mapped,
      received_qty: toNumber(receipt.received_qty),
    });
    const reversedQty = toNumber(receipt.reversed_qty);
    const receivedQty = toNumber(receipt.received_qty);
    return {
      ...normalizedReceipt,
      reversed_qty: reversedQty,
      reversal_count: toNumber(receipt.reversal_count),
      last_reversed_at: toNumber(receipt.last_reversed_at),
      available_reversal_qty: Math.max(receivedQty - reversedQty, 0),
      is_reversed: reversedQty > 0 || toNumber(receipt.reversal_count) > 0,
    };
  });

  return {
    ...po,
    ...summarizePurchaseOrderItems(poItems),
    items: poItems,
    receipts: receiptRows,
  };
}

export async function listPurchaseOrders({ db, filters = {} }) {
  const { status, search = '', page = 1, limit = 20 } = filters;
  const { page: safePage, limit: safeLimit, offset } = parseRepoPagination(
    { page, limit },
    { defaultPage: 1, defaultLimit: 20, maxLimit: 100 }
  );

  let where = '1=1';
  const params = [];

  if (status) {
    where += ' AND status = ?';
    params.push(status);
  }
  if (search) {
    where += ' AND (po_no LIKE ? OR remark LIKE ?)';
    const like = `%${String(search).trim()}%`;
    params.push(like, like);
  }

  // count 和 list 查询无依赖关系，并行执行
  const [countResult, { results }] = await Promise.all([
    db
      .prepare(`SELECT COUNT(*) as total FROM purchase_orders WHERE ${where}`)
      .bind(...params)
      .first(),
    db
    .prepare(`
      SELECT po.*,
        COALESCE(agg.item_count, 0) AS item_count,
        COALESCE(agg.ordered_qty, 0) AS ordered_qty,
        COALESCE(agg.received_qty, 0) AS received_qty,
        COALESCE(agg.cancelled_qty, 0) AS cancelled_qty,
        COALESCE(agg.outstanding_qty, 0) AS outstanding_qty,
        COALESCE(agg.total_goods_cost, 0) AS total_goods_cost,
        CASE
          WHEN COALESCE(agg.ordered_qty, 0) > 0 AND COALESCE(agg.cancelled_qty, 0) >= COALESCE(agg.ordered_qty, 0) THEN 'cancelled'
          WHEN COALESCE(agg.ordered_qty, 0) > 0 AND COALESCE(agg.outstanding_qty, 0) <= 0 THEN 'received'
          WHEN COALESCE(agg.received_qty, 0) > 0 THEN 'partially_received'
          ELSE 'open'
        END AS display_status
      FROM purchase_orders po
      LEFT JOIN (
        SELECT
          po_id,
          COUNT(*) AS item_count,
          COALESCE(SUM(quantity), 0) AS ordered_qty,
          COALESCE(SUM(received_qty), 0) AS received_qty,
          COALESCE(SUM(cancelled_qty), 0) AS cancelled_qty,
          COALESCE(SUM(MAX(quantity - received_qty - cancelled_qty, 0)), 0) AS outstanding_qty,
          COALESCE(SUM(quantity * unit_cost), 0) AS total_goods_cost
        FROM purchase_order_items
        GROUP BY po_id
      ) agg ON agg.po_id = po.id
      WHERE ${where}
      ORDER BY po.created_at DESC
      LIMIT ? OFFSET ?
    `)
      .bind(...params, safeLimit, offset)
      .all(),
  ]);

  return {
    items: results.map((row) => normalizePurchaseOrderProgress(row)),
    total: countResult?.total || 0,
    page: safePage,
    limit: safeLimit,
  };
}

export async function getPurchaseOrderItemsForAllocation({ db, poId }) {
  const { results } = await db.prepare(`
    SELECT poi.*,
      COALESCE(vagg.min_cost_price, 0) AS product_cost_price,
      v.cost_price AS variant_cost_price
    FROM purchase_order_items poi
    LEFT JOIN products p ON poi.product_id = p.id
    LEFT JOIN product_variants v ON poi.variant_id = v.id
    LEFT JOIN (
      SELECT product_id, MIN(COALESCE(cost_price, 0)) AS min_cost_price
      FROM product_variants
      GROUP BY product_id
    ) vagg ON vagg.product_id = p.id
    WHERE poi.po_id = ?
  `).bind(poId).all();
  return results;
}

export async function getPurchaseOrderStats({ db }) {
  const result = await db.prepare(`
    SELECT
      COUNT(*) AS total,
      COUNT(CASE WHEN status = 'draft' THEN 1 END) AS draft_count,
      COUNT(CASE WHEN status = 'ordered' THEN 1 END) AS ordered_count,
      COUNT(CASE WHEN status = 'shipping' THEN 1 END) AS shipping_count,
      COUNT(CASE WHEN status = 'arrived' THEN 1 END) AS arrived_count,
      COUNT(CASE WHEN status = 'completed' THEN 1 END) AS completed_count,
      COALESCE((SELECT SUM(quantity) FROM purchase_order_items), 0) AS ordered_qty,
      COALESCE((SELECT SUM(received_qty) FROM purchase_order_items), 0) AS received_qty,
      COALESCE((SELECT SUM(cancelled_qty) FROM purchase_order_items), 0) AS cancelled_qty,
      COALESCE((SELECT SUM(MAX(quantity - received_qty - cancelled_qty, 0)) FROM purchase_order_items), 0) AS outstanding_qty
    FROM purchase_orders
  `).first();
  return normalizePurchaseOrderProgress(result || {});
}
