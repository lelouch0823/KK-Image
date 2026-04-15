import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = process.cwd();

describe('PurchaseOrders decomposition audit', () => {
  it('moves purchase-order view helpers into dedicated modules', () => {
    const offenders = [];
    const mainPath = path.join(ROOT, 'src', 'views', 'PurchaseOrders.vue');
    const helperPaths = [
      path.join(ROOT, 'src', 'views', 'purchase-orders', 'formatters.js'),
      path.join(ROOT, 'src', 'views', 'purchase-orders', 'progress.js'),
    ];
    const source = fs.readFileSync(mainPath, 'utf8');

    for (const helperPath of helperPaths) {
      if (!fs.existsSync(helperPath)) {
        offenders.push(`${path.relative(ROOT, helperPath)}: missing extracted helper module`);
      }
    }

    if (!source.includes("@/views/purchase-orders/formatters.js")) {
      offenders.push('src/views/PurchaseOrders.vue: missing purchase-order formatter import');
    }

    if (!source.includes("@/views/purchase-orders/progress.js")) {
      offenders.push('src/views/PurchaseOrders.vue: missing purchase-order progress helper import');
    }

    for (const marker of [
      'const formatDate = (ts) => {',
      'const formatDateTime = (ts) => {',
      'const buildReceiptProgressSummary = (record = {}) => {',
      'const buildReceiptMeta = (record = {}) => {',
    ]) {
      if (source.includes(marker)) {
        offenders.push(`src/views/PurchaseOrders.vue: still defines ${marker}`);
      }
    }

    expect(
      offenders,
      `PurchaseOrders decomposition offenders:\n${offenders.join('\n')}`
    ).toEqual([]);
  });
});
