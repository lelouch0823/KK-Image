import { describe, it, expect } from 'vitest';
import {
  normalizeVariantOptions,
  buildVariantDisplayName,
  getVariantAvailabilityState,
  isVariantSelectable,
} from '../variant-meta.js';

describe('variant-meta (backend)', () => {
  it('normalizes options and builds ordered display name', () => {
    const normalized = normalizeVariantOptions({
      颜色: 'Blue',
      material: 'Linen',
      Size: 'L',
    });
    expect(normalized).toEqual({
      color: 'Blue',
      material: 'Linen',
      size: 'L',
    });
    expect(buildVariantDisplayName(normalized)).toBe('Blue / Linen / L');
  });

  it('calculates availability states and selectability', () => {
    expect(getVariantAvailabilityState({ status: 'active', stock_quantity: 0, alert_threshold: 3 })).toBe('disabled_out_of_stock');
    expect(getVariantAvailabilityState({ status: 'active', stock_quantity: 2, alert_threshold: 3 })).toBe('low_stock');
    expect(getVariantAvailabilityState({ status: 'active', stock_quantity: 4, alert_threshold: 3 })).toBe('available');
    expect(getVariantAvailabilityState({ status: 'archived', stock_quantity: 4, alert_threshold: 3 })).toBe('disabled_archived');
    expect(isVariantSelectable({ status: 'active', stock_quantity: 2, alert_threshold: 3 })).toBe(true);
    expect(isVariantSelectable({ status: 'active', stock_quantity: 0, alert_threshold: 3 })).toBe(false);
  });

  it('supports 2D/1D display names', () => {
    expect(buildVariantDisplayName({ color: 'Green', material: 'Cotton' })).toBe('Green / Cotton');
    expect(buildVariantDisplayName({ size: 'XL' })).toBe('XL');
    expect(buildVariantDisplayName({})).toBe('-');
  });
});
