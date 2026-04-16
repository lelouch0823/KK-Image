import { describe, it } from 'vitest';
import { expectFileUnderEffectiveLineBudget } from '../../../test/utils/line-budget.js';

describe('ProductCatalogService line budget', () => {
  it('keeps ProductCatalogService under 520 effective lines', () => {
    expectFileUnderEffectiveLineBudget('functions/services/ProductCatalogService.js', 520);
  });
});
