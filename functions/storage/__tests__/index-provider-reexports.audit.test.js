import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = process.cwd();
const TARGET = path.join(ROOT, 'functions', 'storage', 'index.js');

describe('storage index provider re-exports audit', () => {
  it('keeps unused provider class re-exports out of storage index', () => {
    const source = fs.readFileSync(TARGET, 'utf8');
    const offenders = [];

    if (source.includes("export { BaseStorageProvider } from './base-provider.js';")) {
      offenders.push('functions/storage/index.js: still re-exports BaseStorageProvider');
    }

    if (source.includes("export { TelegramStorageProvider } from './providers/telegram.js';")) {
      offenders.push('functions/storage/index.js: still re-exports TelegramStorageProvider');
    }

    if (source.includes("export { R2StorageProvider } from './providers/r2.js';")) {
      offenders.push('functions/storage/index.js: still re-exports R2StorageProvider');
    }

    if (source.includes("export { S3StorageProvider } from './providers/s3.js';")) {
      offenders.push('functions/storage/index.js: still re-exports S3StorageProvider');
    }

    expect(
      offenders,
      `storage index provider re-export offenders:\n${offenders.join('\n')}`
    ).toEqual([]);
  });
});
