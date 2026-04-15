import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = process.cwd();

describe('PurchaseOrderRepository decomposition audit', () => {
  it('moves read-model and snapshot helpers into dedicated modules', () => {
    const offenders = [];
    const mainPath = path.join(ROOT, 'functions', 'repositories', 'PurchaseOrderRepository.js');
    const helperPaths = [
      path.join(ROOT, 'functions', 'repositories', 'purchase-order-read-model.js'),
      path.join(ROOT, 'functions', 'repositories', 'purchase-order-snapshot.js'),
    ];
    const source = fs.readFileSync(mainPath, 'utf8');

    for (const helperPath of helperPaths) {
      if (!fs.existsSync(helperPath)) {
        offenders.push(`${path.relative(ROOT, helperPath)}: missing extracted helper module`);
      }
    }

    if (!source.includes("./purchase-order-read-model.js")) {
      offenders.push('functions/repositories/PurchaseOrderRepository.js: missing read-model helper import');
    }

    if (!source.includes("./purchase-order-snapshot.js")) {
      offenders.push('functions/repositories/PurchaseOrderRepository.js: missing snapshot helper import');
    }

    for (const marker of [
      'function normalizePurchaseOrderProgress(',
      'function summarizePurchaseOrderItems(',
      'function mapPurchaseOrderSnapshotFields(',
      'function buildLivePurchaseItemSnapshot(',
    ]) {
      if (source.includes(marker)) {
        offenders.push(`functions/repositories/PurchaseOrderRepository.js: still defines ${marker}`);
      }
    }

    expect(
      offenders,
      `PurchaseOrderRepository decomposition offenders:\n${offenders.join('\n')}`
    ).toEqual([]);
  });
});
