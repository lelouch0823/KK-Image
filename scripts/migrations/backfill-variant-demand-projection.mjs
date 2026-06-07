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
  const args = [
    'wrangler',
    'd1',
    'execute',
    options.database,
    options.remote ? '--remote' : '--local',
    '--command',
    command,
    '--json',
  ];
  const output = execFileSync('npx', args, { encoding: 'utf8' });
  const parsed = JSON.parse(output);

  if (!Array.isArray(parsed)) return [];
  const firstWithResults = parsed.find((entry) => Array.isArray(entry?.results));
  return firstWithResults?.results || [];
}

export function buildSelectVariantDemandProjectionSql({ limit = null } = {}) {
  const clauses = [
    `SELECT
      ol.variant_id AS variant_id,
      COALESCE(SUM(CASE WHEN o.status = 'confirmed' THEN MAX(ol.ordered_qty - ol.cancelled_qty - ol.shipped_qty, 0) ELSE 0 END), 0) AS confirmed_qty,
      COALESCE(SUM(CASE WHEN o.status = 'production' THEN MAX(ol.ordered_qty - ol.cancelled_qty - ol.shipped_qty, 0) ELSE 0 END), 0) AS production_qty,
      COALESCE(SUM(CASE WHEN o.status = 'shipping' THEN MAX(ol.ordered_qty - ol.cancelled_qty - ol.shipped_qty, 0) ELSE 0 END), 0) AS shipping_qty,
      COALESCE(SUM(CASE WHEN o.status = 'arrived' THEN MAX(ol.ordered_qty - ol.cancelled_qty - ol.shipped_qty, 0) ELSE 0 END), 0) AS arrived_qty,
      COALESCE(SUM(MAX(ol.ordered_qty - ol.cancelled_qty - ol.shipped_qty, 0)), 0) AS total_demand,
      COUNT(DISTINCT o.id) AS order_count,
      GROUP_CONCAT(DISTINCT CASE WHEN o.status = 'confirmed' THEN o.id END) AS order_ids,
      MAX(COALESCE(o.updated_at, o.created_at, ol.updated_at, ol.created_at)) AS projection_updated_at
    FROM order_lines ol
    JOIN orders o ON o.id = ol.order_id
    WHERE o.status IN ('confirmed', 'production', 'shipping', 'arrived')
      AND ol.variant_id IS NOT NULL
    GROUP BY ol.variant_id
    ORDER BY ol.variant_id ASC`,
  ];

  if (limit) {
    clauses.push(`LIMIT ${limit}`);
  }

  return clauses.join('\n');
}

export function mapVariantDemandProjectionRow(row = {}) {
  return {
    variant_id: row.variant_id,
    confirmed_qty: Number(row.confirmed_qty || 0),
    production_qty: Number(row.production_qty || 0),
    shipping_qty: Number(row.shipping_qty || 0),
    arrived_qty: Number(row.arrived_qty || 0),
    total_demand: Number(row.total_demand || 0),
    order_count: Number(row.order_count || 0),
    order_ids: row.order_ids || null,
    updated_at: Number(row.projection_updated_at || row.updated_at || 0),
  };
}

export function buildUpsertVariantDemandProjectionSql(row = {}) {
  return `
INSERT INTO variant_demand_projection (
  variant_id,
  confirmed_qty,
  production_qty,
  shipping_qty,
  arrived_qty,
  total_demand,
  order_count,
  order_ids,
  updated_at
) VALUES (
  ${sqlString(row.variant_id)},
  ${sqlNumber(row.confirmed_qty, 0)},
  ${sqlNumber(row.production_qty, 0)},
  ${sqlNumber(row.shipping_qty, 0)},
  ${sqlNumber(row.arrived_qty, 0)},
  ${sqlNumber(row.total_demand, 0)},
  ${sqlNumber(row.order_count, 0)},
  ${sqlNullableString(row.order_ids)},
  ${sqlNumber(row.updated_at, Date.now())}
)
ON CONFLICT(variant_id) DO UPDATE SET
  confirmed_qty = excluded.confirmed_qty,
  production_qty = excluded.production_qty,
  shipping_qty = excluded.shipping_qty,
  arrived_qty = excluded.arrived_qty,
  total_demand = excluded.total_demand,
  order_count = excluded.order_count,
  order_ids = excluded.order_ids,
  updated_at = excluded.updated_at;`.trim();
}

export function buildUpsertVariantDemandProjectionBatchSql(rows = []) {
  return rows.map((row) => buildUpsertVariantDemandProjectionSql(row)).join('\n');
}

export function selectVariantDemandProjectionRows(options) {
  return runD1Json(options, buildSelectVariantDemandProjectionSql({ limit: options.limit }));
}

export function main() {
  const options = parseArgs(process.argv.slice(2));
  const rows = selectVariantDemandProjectionRows(options).map(mapVariantDemandProjectionRow);

  if (!rows.length) {
    console.log('[backfill-variant-demand-projection] no variant demand rows to backfill');
    return;
  }

  if (options.dryRun) {
    console.log(`[backfill-variant-demand-projection] dry-run rows=${rows.length}`);
    return;
  }

  const chunkSize = 50;
  for (let index = 0; index < rows.length; index += chunkSize) {
    runD1Json(
      options,
      buildUpsertVariantDemandProjectionBatchSql(rows.slice(index, index + chunkSize))
    );
  }

  console.log(`[backfill-variant-demand-projection] upserted ${rows.length} rows`);
}

const isMain = process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href;
if (isMain) {
  main();
}
