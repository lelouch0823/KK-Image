import { describe, expect, it } from 'vitest';
import { canonicalizeBusinessText, detectCreateIntent } from '../canonicalization.js';

describe('AI business canonicalization', () => {
  it('maps 规格 and 商品规格 to variant semantics', () => {
    const result = canonicalizeBusinessText('这个商品规格有哪些');

    expect(result.normalizedTerms).toContain('variant');
    expect(result.matches).toEqual(
      expect.arrayContaining([expect.objectContaining({ canonical: 'variant', alias: '商品规格' })])
    );
  });

  it('maps 业务员 to salesperson create entity', () => {
    const result = detectCreateIntent('帮我新增一个业务员');

    expect(result).toEqual(
      expect.objectContaining({
        entityType: 'salesperson',
        actionType: 'create_salesperson',
      })
    );
  });

  it('prefers purchase-order intent over generic order intent when the text contains 采购单', () => {
    const result = detectCreateIntent('帮我创建采购单');

    expect(result).toEqual(
      expect.objectContaining({
        entityType: 'purchase_order',
        actionType: 'create_purchase_order',
      })
    );
  });
});
