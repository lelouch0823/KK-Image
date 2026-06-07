import { afterEach, describe, expect, it, vi } from 'vitest';
import { gzipSync } from 'node:zlib';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  RESTORE_ORDER,
  generateInsertSql,
  parseArgs,
  readGzipJson,
  runRestoreCli,
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

  it('exports a reusable cli runner', () => {
    expect(typeof runRestoreCli).toBe('function');
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

  it('returns usage or missing-file failures before reading backups', async () => {
    const printLine = vi.fn();
    const logImpl = vi.fn();

    await expect(
      runRestoreCli({
        args: [],
        printLine,
        logImpl,
      })
    ).resolves.toBe(1);
    expect(printLine).toHaveBeenCalled();

    await expect(
      runRestoreCli({
        args: ['missing.json.gz'],
        existsSyncImpl: vi.fn(() => false),
        printLine: vi.fn(),
        logImpl,
      })
    ).resolves.toBe(1);
    expect(logImpl).toHaveBeenCalledWith('备份文件不存在: missing.json.gz', 'error');
  });

  it('handles invalid backup payloads and dry-run planning', async () => {
    const printLine = vi.fn();
    const logImpl = vi.fn();

    await expect(
      runRestoreCli({
        args: ['backup.json.gz'],
        existsSyncImpl: vi.fn(() => true),
        readGzipJsonImpl: vi.fn(async () => ({ nope: true })),
        printLine,
        logImpl,
      })
    ).resolves.toBe(1);
    expect(logImpl).toHaveBeenCalledWith('备份文件格式无效 (缺少 metadata 或 data)', 'error');

    const dryRunExitCode = await runRestoreCli({
      args: ['backup.json.gz', '--dry-run'],
      existsSyncImpl: vi.fn(() => true),
      readGzipJsonImpl: vi.fn(async () => ({
        metadata: { createdAt: '2026-04-18T00:00:00.000Z', version: '1.0.0' },
        data: {
          blobs: { rows: [{ id: 'b1' }] },
          folders: { rows: [{ id: 'f1' }] },
          unknown_table: { rows: [{ id: 'x1' }] },
        },
      })),
      printLine,
      logImpl,
    });

    expect(dryRunExitCode).toBe(0);
    expect(printLine).toHaveBeenCalledWith('  blobs: 1 条');
    expect(printLine).toHaveBeenCalledWith('  folders: 1 条');
    expect(logImpl).toHaveBeenCalledWith('未知表 "unknown_table" 将被跳过', 'warn');
  });

  it('supports remote wait, optional clear-first, and batch restore continuation', async () => {
    const logImpl = vi.fn();
    const writeFileSyncImpl = vi.fn();
    const execSyncImpl = vi
      .fn()
      .mockReturnValueOnce(Buffer.from('drop ok'))
      .mockReturnValueOnce(Buffer.from('batch1 ok'))
      .mockImplementationOnce(() => {
        throw new Error('batch2 failed');
      })
      .mockReturnValueOnce(Buffer.from('batch3 ok'));

    const exitCode = await runRestoreCli({
      parsedOptions: {
        backupFile: 'backup.json.gz',
        database: 'kk-life-db',
        remote: true,
        dryRun: false,
        clearFirst: true,
      },
      existsSyncImpl: vi.fn(() => true),
      readGzipJsonImpl: vi.fn(async () => ({
        metadata: { createdAt: '2026-04-18T00:00:00.000Z', version: '1.0.0' },
        data: {
          blobs: { rows: Array.from({ length: 101 }, (_, index) => ({ id: `b-${index}` })) },
        },
      })),
      writeFileSyncImpl,
      execSyncImpl,
      sleepImpl: vi.fn(async () => {}),
      printLine: vi.fn(),
      logImpl,
    });

    expect(exitCode).toBe(0);
    expect(writeFileSyncImpl).toHaveBeenCalledWith(
      '/tmp/restore_drop.sql',
      expect.stringContaining('DROP TABLE IF EXISTS "storage_mirrors";'),
      'utf-8'
    );
    expect(execSyncImpl).toHaveBeenCalledWith(
      'npx wrangler d1 execute kk-life-db --remote --file=/tmp/restore_drop.sql',
      { stdio: 'pipe' }
    );
    expect(logImpl).toHaveBeenCalledWith('按 Ctrl+C 取消，或等待 5 秒继续...', 'warn');
    expect(logImpl).toHaveBeenCalledWith('批次 2 执行失败', 'warn');
    expect(logImpl).toHaveBeenCalledWith('blobs: 100/101 条恢复成功', 'success');
    expect(logImpl).toHaveBeenCalledWith('🎉 数据库恢复完成!', 'success');
  });
});
