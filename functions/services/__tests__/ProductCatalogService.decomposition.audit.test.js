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
      path.join(ROOT, 'functions', 'services', 'product-catalog', 'batch-execution.js'),
      path.join(ROOT, 'functions', 'services', 'product-catalog', 'preload-existing.js'),
      path.join(ROOT, 'functions', 'services', 'product-catalog', 'bulk-upsert.js'),
      path.join(ROOT, 'functions', 'services', 'product-catalog', 'create.js'),
      path.join(ROOT, 'functions', 'services', 'product-catalog', 'dimensions.js'),
      path.join(ROOT, 'functions', 'services', 'product-catalog', 'patch.js'),
      path.join(ROOT, 'functions', 'services', 'product-catalog', 'variant-matching.js'),
      path.join(ROOT, 'functions', 'services', 'product-catalog', 'maintenance.js'),
      path.join(ROOT, 'functions', 'services', 'product-catalog', 'variant-images.js'),
    ];
    const source = fs.readFileSync(mainPath, 'utf8');

    for (const helperPath of helperPaths) {
      if (!fs.existsSync(helperPath)) {
        offenders.push(`${path.relative(ROOT, helperPath)}: missing extracted helper module`);
      }
    }

    if (!source.includes('./product-catalog/batch-import.js')) {
      offenders.push(
        'functions/services/ProductCatalogService.js: missing batch-import helper import'
      );
    }

    if (!source.includes('./product-catalog/batch-execution.js')) {
      offenders.push(
        'functions/services/ProductCatalogService.js: missing batch-execution helper import'
      );
    }

    const batchExecutionSource = fs.readFileSync(
      path.join(ROOT, 'functions', 'services', 'product-catalog', 'batch-execution.js'),
      'utf8'
    );
    if (!batchExecutionSource.includes('./preload-existing.js')) {
      offenders.push(
        'functions/services/product-catalog/batch-execution.js: missing preload-existing helper import'
      );
    }
    if (!batchExecutionSource.includes('./bulk-upsert.js')) {
      offenders.push(
        'functions/services/product-catalog/batch-execution.js: missing bulk-upsert helper import'
      );
    }

    if (!source.includes('./product-catalog/create.js')) {
      offenders.push('functions/services/ProductCatalogService.js: missing create helper import');
    }

    if (!source.includes('./product-catalog/dimensions.js')) {
      offenders.push(
        'functions/services/ProductCatalogService.js: missing dimensions helper import'
      );
    }

    if (!source.includes('./product-catalog/patch.js')) {
      offenders.push('functions/services/ProductCatalogService.js: missing patch helper import');
    }

    if (!source.includes('./product-catalog/variant-matching.js')) {
      offenders.push(
        'functions/services/ProductCatalogService.js: missing variant-matching helper import'
      );
    }

    for (const marker of [
      'function buildCatalogRollbackPayload(',
      'const safeMergeField =',
      'export const buildVariantMatchKey =',
      'export const mergeIncomingWithExisting =',
      'async cleanupCreatedCatalogRecords(created) {',
      'async loadVariantImageSnapshot(productId, variants = [], variantImageRepo = new VariantImageRepository(this.db, this.variantRepo)) {',
      'async rollbackPatchedProduct({',
      'const variantImageRepo = new VariantImageRepository(this.db, this.variantRepo);',
      'const imageSyncPlan = resolveVariantImageSyncPlan({',
      'async syncDimensionsFromPayload(productId, incomingDimensions = [], { replaceMissing = false } = {}) {',
      'async patchProduct(c, productId, body, {',
      'async batchImport(c, body = {}, options = {}) {',
      'const created = {',
      'product = await productRepo.create(body);',
      'const normalizedVariants = normalizeVariantDimensionKeys(',
      'await syncCatalogVariantImages({',
      'await cleanupCreatedCatalogRecords({ db, created });',
    ]) {
      if (source.includes(marker)) {
        offenders.push(`functions/services/ProductCatalogService.js: still defines ${marker}`);
      }
    }

    if (!source.includes('executeProductCatalogCreate({')) {
      offenders.push(
        'functions/services/ProductCatalogService.js: missing create helper delegation'
      );
    }
    if (!source.includes('executeProductCatalogBatchImport({')) {
      offenders.push(
        'functions/services/ProductCatalogService.js: missing batch import helper delegation'
      );
    }
    if (!batchExecutionSource.includes('preloadBatchImportExistingState({')) {
      offenders.push(
        'functions/services/product-catalog/batch-execution.js: missing preload delegation'
      );
    }
    if (!batchExecutionSource.includes('executeBulkProductImportUpsert({')) {
      offenders.push(
        'functions/services/product-catalog/batch-execution.js: missing bulk upsert delegation'
      );
    }

    expect(
      offenders,
      `ProductCatalogService decomposition offenders:\n${offenders.join('\n')}`
    ).toEqual([]);
  });
});
