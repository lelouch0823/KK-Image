import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = process.cwd();
const TARGETS = [
  {
    file: path.join(ROOT, 'functions', 'lib', 'hono', 'routes', 'manage', 'purchase-orders.js'),
    signature: 'async function requirePurchaseOrder(',
    label: 'functions/lib/hono/routes/manage/purchase-orders.js: still defines requirePurchaseOrder',
  },
  {
    file: path.join(ROOT, 'functions', 'lib', 'hono', 'routes', 'manage', 'orders', 'detail.js'),
    signature: 'async function requireOrder(',
    label: 'functions/lib/hono/routes/manage/orders/detail.js: still defines requireOrder',
  },
];

describe('manage route entity thin wrappers audit', () => {
  it('keeps local requireEntity pass-through wrappers out of selected routes', () => {
    const offenders = [];

    for (const target of TARGETS) {
      const source = fs.readFileSync(target.file, 'utf8');
      if (source.includes(target.signature)) offenders.push(target.label);
    }

    expect(
      offenders,
      `route thin-wrapper offenders:\n${offenders.join('\n')}`
    ).toEqual([]);
  });
});
