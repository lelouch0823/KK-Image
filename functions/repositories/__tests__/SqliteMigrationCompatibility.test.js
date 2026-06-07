import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

function readMigration(name) {
  return readFileSync(path.resolve(process.cwd(), `migrations/${name}`), 'utf8');
}

describe('sqlite migration compatibility', () => {
  it('uses a disambiguating WHERE clause before UPSERT in 0073 order payload sidecar backfill', () => {
    const sql = readMigration('0073_order_payload_sidecar.sql');

    expect(sql).toContain('FROM orders');
    expect(sql).toContain('ON CONFLICT(order_id) DO UPDATE SET');
    expect(sql).toMatch(
      /FROM orders\s+WHERE\s+(?:1|true)\s+ON CONFLICT\(order_id\)\s+DO UPDATE SET/i
    );
  });
});
