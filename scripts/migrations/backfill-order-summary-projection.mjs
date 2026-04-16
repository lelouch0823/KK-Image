#!/usr/bin/env node

import { execFileSync } from 'node:child_process';

const DEFAULT_DB = 'DB';

export function parseArgs(argv = []) {
  const options = {
    database: DEFAULT_DB,
    remote: false,
    dryRun: false,
    limit: null,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--database' || arg === '-d') {
      options.database = argv[index + 1] || DEFAULT_DB;
      index += 1;
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
      const parsed = Number(argv[index + 1]);
      if (Number.isFinite(parsed) && parsed > 0) {
        options.limit = Math.floor(parsed);
      }
      index += 1;
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

export function buildSelectOrdersNeedingProjectionSql({ limit = null } = {}) {
  const clauses = [
    `SELECT
      o.id AS order_id,
      line_snapshot.snapshot_name AS snapshot_name,
      CASE
        WHEN line_agg.order_id IS NULL THEN NULL
        WHEN line_agg.ordered_qty > 0 AND line_agg.cancelled_qty >= line_agg.ordered_qty THEN 'cancelled'
        WHEN MAX(line_agg.ordered_qty - line_agg.cancelled_qty, 0) > 0 AND line_agg.shipped_qty >= MAX(line_agg.ordered_qty - line_agg.cancelled_qty, 0) THEN 'completed'
        WHEN line_agg.shipped_qty > 0 THEN 'partially_shipped'
        WHEN MAX(line_agg.ordered_qty - line_agg.cancelled_qty, 0) > 0 AND line_agg.received_qty >= MAX(line_agg.ordered_qty - line_agg.cancelled_qty, 0) THEN 'ready'
        WHEN line_agg.received_qty > 0 THEN 'partially_received'
        WHEN MAX(line_agg.ordered_qty - line_agg.cancelled_qty, 0) > 0 AND line_agg.procured_qty >= MAX(line_agg.ordered_qty - line_agg.cancelled_qty, 0) THEN 'fully_procured'
        WHEN line_agg.procured_qty > 0 THEN 'partially_procured'
        ELSE 'unprocured'
      END AS display_status,
      COALESCE(line_agg.ordered_qty, 0) AS ordered_qty,
      COALESCE(line_agg.procured_qty, 0) AS procured_qty,
      COALESCE(line_agg.received_qty, 0) AS received_qty,
      COALESCE(line_agg.shipped_qty, 0) AS shipped_qty,
      COALESCE(return_agg.returned_qty, 0) AS returned_qty,
      COALESCE(line_agg.cancelled_qty, 0) AS cancelled_qty,
      CASE
        WHEN COALESCE(line_agg.shipped_qty, 0) > 0
          AND COALESCE(return_agg.returned_qty, 0) >= COALESCE(line_agg.shipped_qty, 0)
          AND COALESCE(return_agg.returned_qty, 0) > 0 THEN 'returned'
        WHEN COALESCE(return_agg.returned_qty, 0) > 0 THEN 'partially_returned'
        WHEN LOWER(TRIM(COALESCE(o.delivery_status, ''))) IN ('not_shipped', 'in_transit', 'delivered', 'partially_returned', 'returned')
          THEN LOWER(TRIM(o.delivery_status))
        WHEN COALESCE(o.delivered_at, 0) > 0 THEN 'delivered'
        WHEN COALESCE(line_agg.shipped_qty, 0) > 0 THEN 'in_transit'
        ELSE 'not_shipped'
      END AS effective_delivery_status,
      COALESCE(o.updated_at, o.created_at) AS projection_updated_at
    FROM orders o
    LEFT JOIN order_summary_projection existing_projection ON existing_projection.order_id = o.id
    LEFT JOIN (
      SELECT
        order_id,
        COALESCE(SUM(ordered_qty), 0) AS ordered_qty,
        COALESCE(SUM(procured_qty), 0) AS procured_qty,
        COALESCE(SUM(received_qty), 0) AS received_qty,
        COALESCE(SUM(shipped_qty), 0) AS shipped_qty,
        COALESCE(SUM(cancelled_qty), 0) AS cancelled_qty
      FROM order_lines
      GROUP BY order_id
    ) line_agg ON line_agg.order_id = o.id
    LEFT JOIN (
      SELECT
        order_id,
        COALESCE(SUM(quantity), 0) AS returned_qty
      FROM order_returns
      WHERE status != 'cancelled'
      GROUP BY order_id
    ) return_agg ON return_agg.order_id = o.id
    LEFT JOIN (
      SELECT ranked_lines.order_id, ranked_lines.snapshot_name
      FROM (
        SELECT
          order_id,
          snapshot_name,
          ROW_NUMBER() OVER (
            PARTITION BY order_id
            ORDER BY created_at ASC, id ASC
          ) AS row_num
        FROM order_lines
        WHERE COALESCE(snapshot_name, '') != ''
      ) ranked_lines
      WHERE ranked_lines.row_num = 1
    ) line_snapshot ON line_snapshot.order_id = o.id
    WHERE existing_projection.order_id IS NULL
      OR existing_projection.updated_at < COALESCE(o.updated_at, o.created_at)
    ORDER BY o.created_at ASC`,
  ];

  if (limit) {
    clauses.push(`LIMIT ${limit}`);
  }

  return clauses.join('\n');
}

export function mapOrderSummaryProjectionRow(row = {}) {
  return {
    order_id: row.order_id,
    snapshot_name: row.snapshot_name || null,
    display_status: row.display_status || null,
    ordered_qty: Number(row.ordered_qty || 0),
    procured_qty: Number(row.procured_qty || 0),
    received_qty: Number(row.received_qty || 0),
    shipped_qty: Number(row.shipped_qty || 0),
    returned_qty: Number(row.returned_qty || 0),
    cancelled_qty: Number(row.cancelled_qty || 0),
    effective_delivery_status: row.effective_delivery_status || 'not_shipped',
    updated_at: Number(row.projection_updated_at || row.updated_at || 0),
  };
}

export function buildUpsertOrderSummaryProjectionSql(row = {}) {
  return `
INSERT INTO order_summary_projection (
  order_id,
  snapshot_name,
  display_status,
  ordered_qty,
  procured_qty,
  received_qty,
  shipped_qty,
  returned_qty,
  cancelled_qty,
  effective_delivery_status,
  updated_at
) VALUES (
  ${sqlString(row.order_id)},
  ${sqlNullableString(row.snapshot_name)},
  ${sqlNullableString(row.display_status)},
  ${sqlNumber(row.ordered_qty, 0)},
  ${sqlNumber(row.procured_qty, 0)},
  ${sqlNumber(row.received_qty, 0)},
  ${sqlNumber(row.shipped_qty, 0)},
  ${sqlNumber(row.returned_qty, 0)},
  ${sqlNumber(row.cancelled_qty, 0)},
  ${sqlString(row.effective_delivery_status || 'not_shipped')},
  ${sqlNumber(row.updated_at, Date.now())}
)
ON CONFLICT(order_id) DO UPDATE SET
  snapshot_name = excluded.snapshot_name,
  display_status = excluded.display_status,
  ordered_qty = excluded.ordered_qty,
  procured_qty = excluded.procured_qty,
  received_qty = excluded.received_qty,
  shipped_qty = excluded.shipped_qty,
  returned_qty = excluded.returned_qty,
  cancelled_qty = excluded.cancelled_qty,
  effective_delivery_status = excluded.effective_delivery_status,
  updated_at = excluded.updated_at;`.trim();
}

export function buildUpsertOrderSummaryProjectionBatchSql(rows = []) {
  return rows.map((row) => buildUpsertOrderSummaryProjectionSql(row)).join('\n');
}

export function selectOrdersNeedingProjection(options) {
  return runD1Json(options, buildSelectOrdersNeedingProjectionSql({ limit: options.limit }));
}

export function main() {
  const options = parseArgs(process.argv.slice(2));
  const rows = selectOrdersNeedingProjection(options).map(mapOrderSummaryProjectionRow);

  if (!rows.length) {
    console.log('[backfill-order-summary-projection] no orders to backfill');
    return;
  }

  if (options.dryRun) {
    console.log(`[backfill-order-summary-projection] dry-run rows=${rows.length}`);
    return;
  }

  const chunkSize = 50;
  for (let index = 0; index < rows.length; index += chunkSize) {
    runD1Json(options, buildUpsertOrderSummaryProjectionBatchSql(rows.slice(index, index + chunkSize)));
  }

  console.log(`[backfill-order-summary-projection] upserted ${rows.length} rows`);
}

const isMain = process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href;
if (isMain) {
  main();
}
