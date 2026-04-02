import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = process.cwd();
const TARGET = path.join(ROOT, 'functions', 'repositories', 'order', 'mutations.js');

describe('order inventory service wrapper audit', () => {
  it('keeps local inventory service fallback wrappers out of order mutations', () => {
    const source = fs.readFileSync(TARGET, 'utf8');
    const offenders = [];

    if (source.includes('function resolveInventoryService(')) {
      offenders.push('functions/repositories/order/mutations.js: still defines resolveInventoryService');
    }

    expect(
      offenders,
      `order inventory service wrapper offenders:\n${offenders.join('\n')}`
    ).toEqual([]);
  });
});
