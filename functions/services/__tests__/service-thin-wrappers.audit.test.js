import { describe, expect, it } from 'vitest';

import { OrderLineFulfillmentService } from '../OrderLineFulfillmentService.js';
import { OrderProcurementDomainService } from '../OrderProcurementDomainService.js';
import { OrderProcurementReceiptReversalService } from '../OrderProcurementReceiptReversalService.js';
import { PurchaseOrderShortageClosureService } from '../PurchaseOrderShortageClosureService.js';

describe('service thin wrappers audit', () => {
  it('keeps thin shared-helper wrappers out of service prototypes', () => {
    expect(OrderProcurementDomainService.prototype).not.toHaveProperty(
      'requireReceivablePurchaseOrder'
    );
    expect(OrderProcurementDomainService.prototype).not.toHaveProperty(
      'requirePurchaseOrderItemForPo'
    );
    expect(OrderProcurementDomainService.prototype).not.toHaveProperty('queryInventoryBalance');
    expect(OrderProcurementDomainService.prototype).not.toHaveProperty(
      'buildPurchaseOrderItemReceiptStatement'
    );
    expect(OrderProcurementDomainService.prototype).not.toHaveProperty(
      'buildOrderLineProgressStatement'
    );
    expect(OrderProcurementDomainService.prototype).not.toHaveProperty(
      'buildCompatibilityOrderStatusStatement'
    );

    expect(OrderProcurementReceiptReversalService.prototype).not.toHaveProperty(
      'requireReversiblePurchaseOrder'
    );
    expect(OrderProcurementReceiptReversalService.prototype).not.toHaveProperty(
      'requirePurchaseOrderItem'
    );
    expect(OrderProcurementReceiptReversalService.prototype).not.toHaveProperty(
      'queryInventoryBalance'
    );
    expect(OrderProcurementReceiptReversalService.prototype).not.toHaveProperty(
      'buildPurchaseOrderItemReversalStatement'
    );
    expect(OrderProcurementReceiptReversalService.prototype).not.toHaveProperty(
      'buildPurchaseOrderItemRevertStatement'
    );
    expect(OrderProcurementReceiptReversalService.prototype).not.toHaveProperty(
      'buildOrderLineReversalStatement'
    );
    expect(OrderProcurementReceiptReversalService.prototype).not.toHaveProperty(
      'buildOrderLineRevertStatement'
    );

    expect(PurchaseOrderShortageClosureService.prototype).not.toHaveProperty(
      'requireClosablePurchaseOrder'
    );
    expect(PurchaseOrderShortageClosureService.prototype).not.toHaveProperty(
      'requirePurchaseOrderItemForPo'
    );
    expect(PurchaseOrderShortageClosureService.prototype).not.toHaveProperty(
      'buildShortageClosureStatement'
    );
    expect(PurchaseOrderShortageClosureService.prototype).not.toHaveProperty(
      'buildShortageClosureRevertStatement'
    );

    expect(OrderLineFulfillmentService.prototype).not.toHaveProperty('queryInventoryBalance');
    expect(OrderLineFulfillmentService.prototype).not.toHaveProperty(
      'buildOrderLineUpdateStatement'
    );
  });
});
