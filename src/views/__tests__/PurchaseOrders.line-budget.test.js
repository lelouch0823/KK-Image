import { describe, it } from 'vitest';
import { expectFileUnderEffectiveLineBudget } from '../../../test/utils/line-budget.js';

describe('PurchaseOrders line budget', () => {
  it('keeps PurchaseOrders route shell under 800 effective lines', () => {
    expectFileUnderEffectiveLineBudget('src/views/PurchaseOrders.vue', 800);
  });
});
