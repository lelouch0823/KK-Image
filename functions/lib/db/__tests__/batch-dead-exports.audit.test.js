import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = process.cwd();
const TARGET = path.join(ROOT, 'functions', 'lib', 'db', 'batch.js');

describe('db batch dead exports audit', () => {
  it('keeps dead helpers out of shared db batch exports', () => {
    const source = fs.readFileSync(TARGET, 'utf8');
    const offenders = [];

    if (source.includes('export const D1_MAX_BATCH_SIZE')) {
      offenders.push('functions/lib/db/batch.js: still defines D1_MAX_BATCH_SIZE');
    }

    if (source.includes('export async function batchInsert(')) {
      offenders.push('functions/lib/db/batch.js: still defines batchInsert');
    }

    if (source.includes('export async function batchUpdate(')) {
      offenders.push('functions/lib/db/batch.js: still defines batchUpdate');
    }

    if (source.includes('export async function batchDelete(')) {
      offenders.push('functions/lib/db/batch.js: still defines batchDelete');
    }

    if (source.includes('export async function batchUpsert(')) {
      offenders.push('functions/lib/db/batch.js: still defines batchUpsert');
    }

    if (source.includes('export async function transaction(')) {
      offenders.push('functions/lib/db/batch.js: still defines transaction');
    }

    expect(
      offenders,
      `db batch dead-export offenders:\n${offenders.join('\n')}`
    ).toEqual([]);
  });
});
