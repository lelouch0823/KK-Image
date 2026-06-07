import { describe, expect, it } from 'vitest';
import { inferAIEntityContext, inferCurrentView } from '../context-inference';

describe('AI context inference', () => {
  it('infers admin view from route path', () => {
    expect(inferCurrentView('/admin/products')).toBe('products');
    expect(inferCurrentView('/foo')).toBe('dashboard');
  });

  it('prioritizes explicit query entity ids', () => {
    const context = inferAIEntityContext({
      view: 'products',
      params: { id: 'prod-param' },
      query: { variantId: 'var-query' },
    });
    expect(context).toEqual({ selectedId: 'var-query', selectedType: 'variant' });
  });

  it('maps generic id by view when explicit typed query is absent', () => {
    expect(
      inferAIEntityContext({
        view: 'orders',
        params: { id: 'ord-1' },
        query: {},
      })
    ).toEqual({ selectedId: 'ord-1', selectedType: 'order' });

    expect(
      inferAIEntityContext({
        view: 'goods-overview',
        params: {},
        query: { id: 'var-2' },
      })
    ).toEqual({ selectedId: 'var-2', selectedType: 'variant' });

    expect(
      inferAIEntityContext({
        view: 'purchase-orders',
        params: {},
        query: { id: 'po-2' },
      })
    ).toEqual({ selectedId: 'po-2', selectedType: null });
  });

  it('keeps unknown view type as null while preserving id', () => {
    const context = inferAIEntityContext({
      view: 'dashboard',
      params: { id: 'abc' },
      query: {},
    });
    expect(context).toEqual({ selectedId: 'abc', selectedType: null });
  });
});
