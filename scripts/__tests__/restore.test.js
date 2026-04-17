import { afterEach, describe, expect, it } from 'vitest';
import { gzipSync } from 'node:zlib';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  RESTORE_ORDER,
  generateInsertSql,
  parseArgs,
  readGzipJson,
  toSqlValue,
} from '../restore.js';

describe('restore script helpers', () => {
  let tempDir = null;

  afterEach(() => {
    if (tempDir) {
      rmSync(tempDir, { recursive: true, force: true });
      tempDir = null;
    }
  });

  it('parses backup file and restore flags from argv', () => {
    expect(
      parseArgs([
        'backup_2026.json.gz',
        '--database',
        'prod-db',
        '--remote',
        '--dry-run',
        '--clear-first',
      ])
    ).toEqual({
      backupFile: 'backup_2026.json.gz',
      database: 'prod-db',
      remote: true,
      dryRun: true,
      clearFirst: true,
    });
  });

  it('converts javascript values into SQL literals', () => {
    expect(toSqlValue(null)).toBe('NULL');
    expect(toSqlValue(undefined)).toBe('NULL');
    expect(toSqlValue(42)).toBe('42');
    expect(toSqlValue(true)).toBe('1');
    expect(toSqlValue(false)).toBe('0');
    expect(toSqlValue("O'Hara")).toBe("'O''Hara'");
  });

  it('builds insert statements with escaped string content', () => {
    expect(
      generateInsertSql('customers', {
        id: 'cust-1',
        name: "O'Hara",
        active: true,
        note: null,
      })
    ).toBe(
      `INSERT OR IGNORE INTO "customers" ("id", "name", "active", "note") VALUES ('cust-1', 'O''Hara', 1, NULL);`
    );
  });

  it('reads gzipped backup json payloads', async () => {
    tempDir = mkdtempSync(path.join(os.tmpdir(), 'restore-script-'));
    const backupPath = path.join(tempDir, 'backup.json.gz');
    const payload = {
      metadata: { createdAt: '2026-04-18T00:00:00.000Z', version: '1.0.0' },
      data: { folders: { rows: [{ id: 'folder-1' }] } },
    };

    writeFileSync(backupPath, gzipSync(Buffer.from(JSON.stringify(payload))));

    await expect(readGzipJson(backupPath)).resolves.toEqual(payload);
  });

  it('keeps foundational restore order constraints intact', () => {
    expect(RESTORE_ORDER.slice(0, 6)).toEqual([
      'blobs',
      'users',
      'customers',
      'salespersons',
      'webhooks',
      'notifications',
    ]);
    expect(RESTORE_ORDER.indexOf('folders')).toBeLessThan(RESTORE_ORDER.indexOf('files'));
    expect(RESTORE_ORDER.indexOf('files')).toBeLessThan(RESTORE_ORDER.indexOf('albums'));
    expect(RESTORE_ORDER.at(-1)).toBe('storage_mirrors');
  });
});
