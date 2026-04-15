import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = process.cwd();

describe('ProductCatalogService decomposition audit', () => {
  it('moves batch-import and variant matching helpers into dedicated modules', () => {
    const offenders = [];
    const mainPath = path.join(ROOT, 'functions', 'services', 'ProductCatalogService.js');
    const helperPaths = [
      path.join(ROOT, 'functions', 'services', 'product-catalog', 'batch-import.js'),
      path.join(ROOT, 'functions', 'services', 'product-catalog', 'variant-matching.js'),
      path.join(ROOT, 'functions', 'services', 'product-catalog', 'maintenance.js'),
    ];
    const source = fs.readFileSync(mainPath, 'utf8');

    for (const helperPath of helperPaths) {
      if (!fs.existsSync(helperPath)) {
        offenders.push(`${path.relative(ROOT, helperPath)}: missing extracted helper module`);
      }
    }

    if (!source.includes("./product-catalog/batch-import.js")) {
      offenders.push('functions/services/ProductCatalogService.js: missing batch-import helper import');
    }

    if (!source.includes("./product-catalog/variant-matching.js")) {
      offenders.push('functions/services/ProductCatalogService.js: missing variant-matching helper import');
    }

    if (!source.includes("./product-catalog/maintenance.js")) {
      offenders.push('functions/services/ProductCatalogService.js: missing maintenance helper import');
    }

    for (const marker of [
      'function buildCatalogRollbackPayload(',
      'const safeMergeField =',
      'export const buildVariantMatchKey =',
      'export const mergeIncomingWithExisting =',
      'async cleanupCreatedCatalogRecords(created) {',
      'async loadVariantImageSnapshot(productId, variants = [], variantImageRepo = new VariantImageRepository(this.db, this.variantRepo)) {',
      'async rollbackPatchedProduct({',
    ]) {
      if (source.includes(marker)) {
        offenders.push(`functions/services/ProductCatalogService.js: still defines ${marker}`);
      }
    }

    expect(
      offenders,
      `ProductCatalogService decomposition offenders:\n${offenders.join('\n')}`
    ).toEqual([]);
  });
});
