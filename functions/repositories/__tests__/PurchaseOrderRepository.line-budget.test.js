import { describe, it } from 'vitest';
import { expectFileUnderEffectiveLineBudget } from '../../../test/utils/line-budget.js';

describe('PurchaseOrderRepository line budget', () => {
  it('keeps PurchaseOrderRepository under 560 effective lines', () => {
    expectFileUnderEffectiveLineBudget('functions/repositories/PurchaseOrderRepository.js', 560);
  });
});
