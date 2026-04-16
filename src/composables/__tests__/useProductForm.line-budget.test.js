import { describe, it } from 'vitest';
import { expectFileUnderEffectiveLineBudget } from '../../../test/utils/line-budget.js';

describe('useProductForm line budget', () => {
  it('keeps useProductForm under 650 effective lines', () => {
    expectFileUnderEffectiveLineBudget('src/composables/useProductForm.js', 650);
  });
});
