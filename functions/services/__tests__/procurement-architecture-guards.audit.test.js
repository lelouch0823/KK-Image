import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = process.cwd();

function readSource(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
}

function countOccurrences(source, pattern) {
  return (source.match(pattern) || []).length;
}

describe('procurement architecture guards', () => {
  it('routes procurement command locking through the shared resource-lock helper', () => {
    const receiptSource = readSource('functions/services/OrderProcurementDomainService.js');
    const reversalSource = readSource('functions/services/OrderProcurementReceiptReversalService.js');

    expect(receiptSource).toContain("from './order-procurement-resource-locks.js'");
    expect(receiptSource).toContain('acquireProcurementResourceLocks({');
    expect(receiptSource).not.toContain('purchase_receipt_item_lock');

    expect(reversalSource).toContain("from './order-procurement-resource-locks.js'");
    expect(reversalSource).toContain('acquireProcurementResourceLocks({');
    expect(reversalSource).not.toContain('purchase_receipt_reversal_lock');
  });

  it('refreshes demand projections through the shared refresh service instead of direct repo writes', () => {
    const fulfillmentSource = readSource('functions/services/OrderLineFulfillmentService.js');
    const receiptSource = readSource('functions/services/OrderProcurementDomainService.js');
    const reversalSource = readSource('functions/services/OrderProcurementReceiptReversalService.js');
    const shortageSource = readSource('functions/services/PurchaseOrderShortageClosureService.js');

    for (const source of [
      fulfillmentSource,
      receiptSource,
      reversalSource,
      shortageSource,
    ]) {
      expect(source).toContain('VariantDemandProjectionRefreshService');
      expect(source).toContain('refreshByVariantIds(');
      expect(source).not.toContain('VariantDemandProjectionRepository');
    }
  });

  it('keeps reversal success guards pinned to source-fact writes only', () => {
    const reversalSource = readSource('functions/services/OrderProcurementReceiptReversalService.js');

    expect(countOccurrences(reversalSource, /guardedStatementIndexes\.push\(/g)).toBe(1);
    expect(reversalSource).toContain('buildPurchaseOrderItemReceivedQtyStatement');
    expect(reversalSource).not.toContain('notificationGuardResultIndexes');
    expect(reversalSource).not.toContain('cacheGuardResultIndexes');
  });
});
