import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = process.cwd();

describe('PurchaseOrderRepository decomposition audit', () => {
  it('moves read-model and snapshot helpers into dedicated modules', () => {
    const offenders = [];
    const mainPath = path.join(ROOT, 'functions', 'repositories', 'PurchaseOrderRepository.js');
    const helperPaths = [
      path.join(ROOT, 'functions', 'repositories', 'purchase-order-numbering.js'),
      path.join(ROOT, 'functions', 'repositories', 'purchase-order-queries.js'),
      path.join(ROOT, 'functions', 'repositories', 'purchase-order-item-mutations.js'),
      path.join(ROOT, 'functions', 'repositories', 'purchase-order-read-model.js'),
      path.join(ROOT, 'functions', 'repositories', 'purchase-order-snapshot.js'),
      path.join(ROOT, 'functions', 'repositories', 'purchase-order-item-snapshots.js'),
      path.join(ROOT, 'functions', 'repositories', 'purchase-order-links.js'),
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

    if (!source.includes("./purchase-order-numbering.js")) {
      offenders.push('functions/repositories/PurchaseOrderRepository.js: missing numbering helper import');
    }

    if (!source.includes("./purchase-order-queries.js")) {
      offenders.push('functions/repositories/PurchaseOrderRepository.js: missing queries helper import');
    }

    if (!source.includes("./purchase-order-item-mutations.js")) {
      offenders.push('functions/repositories/PurchaseOrderRepository.js: missing item-mutations helper import');
    }

    if (!source.includes("./purchase-order-snapshot.js")) {
      offenders.push('functions/repositories/PurchaseOrderRepository.js: missing snapshot helper import');
    }

    if (!source.includes("./purchase-order-item-snapshots.js")) {
      offenders.push('functions/repositories/PurchaseOrderRepository.js: missing item snapshot helper import');
    }

    if (!source.includes("./purchase-order-links.js")) {
      offenders.push('functions/repositories/PurchaseOrderRepository.js: missing links helper import');
    }

    for (const marker of [
      'function normalizePurchaseOrderProgress(',
      'function summarizePurchaseOrderItems(',
      'function mapPurchaseOrderSnapshotFields(',
      'function buildLivePurchaseItemSnapshot(',
      'async loadOrderLineSnapshotMap(items = []) {',
      'async loadLivePurchaseItemSnapshotMap(items = []) {',
      'async hydratePurchaseItemSnapshots(items = []) {',
      'SELECT DISTINCT pre_order_id FROM purchase_order_items WHERE po_id = ? AND pre_order_id IS NOT NULL',
      'SELECT latest.variant_id, poi.unit_cost AS last_purchase_price',
      'async generatePoNo() {',
      'async findById(id) {',
      'async list(filters = {}) {',
      'async addItems(poId, items) {',
      'async removeItem(poIdOrItemId, itemIdMaybe) {',
      'async updateItem(poIdOrItemId, itemIdOrUpdates, updatesMaybe) {',
      'async getStats() {',
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
