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

export function buildSelectOrderPayloadRowsSql({ limit = null } = {}) {
  const clauses = [
    `SELECT
      o.id AS order_id,
      o.original_data,
      o.current_data,
      COALESCE(NULLIF(json_extract(o.current_data, '$.name'), ''), NULLIF(json_extract(o.original_data, '$.name'), ''), '') AS summary_name,
      COALESCE(NULLIF(json_extract(o.current_data, '$.brand'), ''), NULLIF(json_extract(o.original_data, '$.brand'), ''), '') AS summary_brand,
      COALESCE(
        NULLIF(json_extract(o.current_data, '$.sku'), ''),
        NULLIF(json_extract(o.current_data, '$.variant_sku'), ''),
        NULLIF(json_extract(o.current_data, '$.spu'), ''),
        NULLIF(json_extract(o.original_data, '$.sku'), ''),
        NULLIF(json_extract(o.original_data, '$.variant_sku'), ''),
        NULLIF(json_extract(o.original_data, '$.spu'), ''),
        ''
      ) AS summary_sku,
      o.updated_at
    FROM orders o
    ORDER BY o.created_at ASC`,
  ];

  if (limit) clauses.push(`LIMIT ${limit}`);
  return clauses.join('\n');
}

export function mapOrderPayloadRow(row = {}) {
  return {
    order_id: row.order_id,
    original_data: row.original_data || '{}',
    current_data: row.current_data || '{}',
    summary_name: row.summary_name || '',
    summary_brand: row.summary_brand || '',
    summary_sku: row.summary_sku || '',
    updated_at: Number(row.updated_at || 0),
  };
}

export function buildUpsertOrderPayloadSql(row = {}) {
  return `
INSERT INTO order_payloads (order_id, original_data, current_data, created_at, updated_at)
VALUES (
  ${sqlString(row.order_id)},
  ${sqlString(row.original_data || '{}')},
  ${sqlString(row.current_data || '{}')},
  ${sqlNumber(row.updated_at, Date.now())},
  ${sqlNumber(row.updated_at, Date.now())}
)
ON CONFLICT(order_id) DO UPDATE SET
  original_data = excluded.original_data,
  current_data = excluded.current_data,
  updated_at = excluded.updated_at;

UPDATE orders
SET
  summary_name = ${sqlString(row.summary_name || '')},
  summary_brand = ${sqlString(row.summary_brand || '')},
  summary_sku = ${sqlString(row.summary_sku || '')}
WHERE id = ${sqlString(row.order_id)};
`.trim();
}

export function main() {
  const options = parseArgs(process.argv.slice(2));
  const rows = runD1Json(options, buildSelectOrderPayloadRowsSql({ limit: options.limit })).map(mapOrderPayloadRow);

  if (!rows.length) {
    console.log('[backfill-order-payloads] no orders to backfill');
    return;
  }

  if (options.dryRun) {
    console.log(`[backfill-order-payloads] dry-run rows=${rows.length}`);
    return;
  }

  for (const row of rows) {
    runD1Json(options, buildUpsertOrderPayloadSql(row));
  }

  console.log(`[backfill-order-payloads] upserted ${rows.length} rows`);
}

const isMain = process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href;
if (isMain) {
  main();
}
