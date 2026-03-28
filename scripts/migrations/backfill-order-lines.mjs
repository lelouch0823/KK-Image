#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DEFAULT_DB = 'DB';

export function parseArgs(argv = []) {
  const options = {
    database: DEFAULT_DB,
    remote: false,
    dryRun: false,
    limit: null,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--database' || arg === '-d') {
      options.database = argv[i + 1] || DEFAULT_DB;
      i += 1;
      continue;
    }
    if (arg === '--remote' || arg === '-r') {
      options.remote = true;
      continue;
    }
    if (arg === '--dry-run') {
      options.dryRun = true;
      continue;
    }
    if (arg === '--limit') {
      const parsed = Number(argv[i + 1]);
      if (Number.isFinite(parsed) && parsed > 0) {
        options.limit = Math.floor(parsed);
      }
      i += 1;
    }
  }

  return options;
}

function sqlString(value) {
  return `'${String(value).replace(/'/g, "''")}'`;
}

function sqlNullableString(value) {
  if (value === null || value === undefined || value === '') return 'NULL';
  return sqlString(value);
}

function sqlNumber(value, fallback = 0) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return String(fallback);
  return String(Math.trunc(numeric));
}

export function runD1Json(options, command) {
  const args = ['wrangler', 'd1', 'execute', options.database, options.remote ? '--remote' : '--local', '--command', command, '--json'];
  const output = execFileSync('npx', args, { encoding: 'utf8' });
  const parsed = JSON.parse(output);

  if (!Array.isArray(parsed)) return [];
  const firstWithResults = parsed.find((entry) => Array.isArray(entry?.results));
  return firstWithResults?.results || [];
}

export function parseJsonLoose(raw, fallback = {}) {
  if (!raw || typeof raw !== 'string') return fallback;
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : fallback;
  } catch {
    return fallback;
  }
}

export function pickSnapshotSpec(currentData) {
  if (currentData.specifications) return currentData.specifications;
  if (currentData.specs) return currentData.specs;
  if (currentData.options_values) return currentData.options_values;
  if (currentData.optionsValues) return currentData.optionsValues;
  return null;
}

function inferLegacyLineProgress(legacyOrder, orderedQty) {
  const status = String(legacyOrder.status || '').trim().toLowerCase();
  const procurementStatus = String(legacyOrder.procurement_status || '').trim().toLowerCase();
  const ordered = Number.isFinite(orderedQty) && orderedQty > 0 ? Math.trunc(orderedQty) : 1;

  const progress = {
    procured_qty: 0,
    received_qty: 0,
    reserved_qty: 0,
    shipped_qty: 0,
    cancelled_qty: 0,
    display_status: 'unprocured',
  };

  if (['void', 'rejected', 'cancelled'].includes(status)) {
    progress.cancelled_qty = ordered;
    progress.display_status = 'cancelled';
    return progress;
  }

  if (['production', 'shipping', 'arrived', 'delivered'].includes(status) || ['planned', 'ordered', 'partially_arrived', 'arrived'].includes(procurementStatus)) {
    progress.procured_qty = ordered;
  }

  if (status === 'delivered') {
    progress.received_qty = ordered;
    progress.shipped_qty = ordered;
    progress.display_status = 'completed';
    return progress;
  }

  if (status === 'arrived' || procurementStatus === 'arrived') {
    progress.received_qty = ordered;
    progress.display_status = 'ready';
    return progress;
  }

  if (procurementStatus === 'partially_arrived' && ordered > 1) {
    progress.received_qty = ordered - 1;
    progress.display_status = 'partially_received';
    return progress;
  }

  if (progress.procured_qty >= ordered) {
    progress.display_status = 'fully_procured';
  } else if (progress.procured_qty > 0) {
    progress.display_status = 'partially_procured';
  }

  return progress;
}

function hasOrdersVariantIdColumn(options) {
  const tableInfoRows = runD1Json(options, "PRAGMA table_info('orders');");
  return tableInfoRows.some((row) => String(row?.name || '').trim() === 'variant_id');
}

export function selectLegacyOrders(options) {
  const hasVariantId = hasOrdersVariantIdColumn(options);
  const clauses = [
    `SELECT id, product_id, ${hasVariantId ? 'variant_id' : 'NULL AS variant_id'}, quantity, status, procurement_status, current_data, main_image_id, created_at, updated_at`,
    'FROM orders o',
    'WHERE NOT EXISTS (SELECT 1 FROM order_lines ol WHERE ol.order_id = o.id)',
    'ORDER BY o.created_at ASC',
  ];
  if (options.limit) clauses.push(`LIMIT ${options.limit}`);
  return runD1Json(options, clauses.join(' '));
}

export function mapLegacyOrderToOrderLine(legacyOrder, timestamp = Date.now()) {
  const currentData = parseJsonLoose(legacyOrder.current_data, {});
  const snapshotSpec = pickSnapshotSpec(currentData);
  const createdAt = Number(legacyOrder.created_at) || timestamp;
  const updatedAt = Number(legacyOrder.updated_at) || createdAt;
  const snapshotImage = currentData.image || currentData.image_url || legacyOrder.main_image_id || null;
  const variantId =
    legacyOrder.variant_id ||
    currentData.variant_id ||
    currentData.variantId ||
    null;
  const snapshotName = currentData.name || currentData.productName || '';
  const snapshotSku = currentData.sku || currentData.variantSku || '';
  const orderedQty = Number(legacyOrder.quantity || 1);
  const normalizedOrderedQty = Number.isFinite(orderedQty) && orderedQty > 0 ? Math.trunc(orderedQty) : 1;
  const progress = inferLegacyLineProgress(legacyOrder, normalizedOrderedQty);

  return {
    id: randomUUID(),
    order_id: legacyOrder.id,
    product_id: legacyOrder.product_id || null,
    variant_id: variantId,
    snapshot_name: snapshotName,
    snapshot_sku: snapshotSku || null,
    snapshot_specs: snapshotSpec ? JSON.stringify(snapshotSpec) : null,
    snapshot_image: snapshotImage,
    ordered_qty: normalizedOrderedQty,
    procured_qty: progress.procured_qty,
    received_qty: progress.received_qty,
    reserved_qty: progress.reserved_qty,
    shipped_qty: progress.shipped_qty,
    cancelled_qty: progress.cancelled_qty,
    display_status: progress.display_status,
    created_at: createdAt,
    updated_at: updatedAt,
  };
}

export function buildInsertOrderLineSql(legacyOrder, timestamp = Date.now()) {
  const row = mapLegacyOrderToOrderLine(legacyOrder, timestamp);

  return `
INSERT INTO order_lines (
  id,
  order_id,
  product_id,
  variant_id,
  snapshot_name,
  snapshot_sku,
  snapshot_specs,
  snapshot_image,
  ordered_qty,
  procured_qty,
  received_qty,
  reserved_qty,
  shipped_qty,
  cancelled_qty,
  display_status,
  created_at,
  updated_at
) VALUES (
  ${sqlString(row.id)},
  ${sqlString(row.order_id)},
  ${sqlNullableString(row.product_id)},
  ${sqlNullableString(row.variant_id)},
  ${sqlString(row.snapshot_name)},
  ${sqlNullableString(row.snapshot_sku)},
  ${sqlNullableString(row.snapshot_specs)},
  ${sqlNullableString(row.snapshot_image)},
  ${sqlNumber(row.ordered_qty, 1)},
  ${sqlNumber(row.procured_qty, 0)},
  ${sqlNumber(row.received_qty, 0)},
  ${sqlNumber(row.reserved_qty, 0)},
  ${sqlNumber(row.shipped_qty, 0)},
  ${sqlNumber(row.cancelled_qty, 0)},
  ${sqlString(row.display_status || 'unprocured')},
  ${sqlNumber(row.created_at, timestamp)},
  ${sqlNumber(row.updated_at, row.created_at)}
);`.trim();
}

export function main() {
  const options = parseArgs(process.argv.slice(2));
  const legacyOrders = selectLegacyOrders(options);

  if (!legacyOrders.length) {
    console.log('[backfill-order-lines] no legacy orders to backfill');
    return;
  }

  if (options.dryRun) {
    console.log(`[backfill-order-lines] dry-run matched ${legacyOrders.length} order(s)`);
    return;
  }

  let inserted = 0;
  for (const legacyOrder of legacyOrders) {
    const sql = buildInsertOrderLineSql(legacyOrder);
    runD1Json(options, sql);
    inserted += 1;
  }

  console.log(`[backfill-order-lines] inserted ${inserted} order_lines row(s)`);
}

const isMain = fileURLToPath(import.meta.url) === path.resolve(process.argv[1] || '');
if (isMain) {
  try {
    main();
  } catch (error) {
    console.error(`[backfill-order-lines] failed: ${error.message}`);
    process.exit(1);
  }
}
