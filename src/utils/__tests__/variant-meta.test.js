import { describe, it, expect } from 'vitest';
import {
  normalizeVariantOptions,
  buildVariantDisplayName,
  getVariantAvailabilityState,
  isVariantSelectable,
} from '../variant-meta.js';

describe('variant-meta (frontend)', () => {
  it('normalizes option keys to color/material/size and builds ordered display name', () => {
    const normalized = normalizeVariantOptions({
      Color: 'Yellow',
      材质: 'Cotton',
      尺码: 'S',
    });

    expect(normalized).toEqual({
      color: 'Yellow',
      material: 'Cotton',
      size: 'S',
    });
    expect(buildVariantDisplayName(normalized)).toBe('Yellow / Cotton / S');
  });

  it('returns availability states and selectability correctly', () => {
    expect(getVariantAvailabilityState({ status: 'archived', stock_quantity: 99, alert_threshold: 10 })).toBe('disabled_archived');
    expect(getVariantAvailabilityState({ status: 'active', stock_quantity: 0, alert_threshold: 10 })).toBe('disabled_out_of_stock');
    expect(getVariantAvailabilityState({ status: 'active', stock_quantity: 3, alert_threshold: 5 })).toBe('low_stock');
    expect(getVariantAvailabilityState({ status: 'active', stock_quantity: 8, alert_threshold: 5 })).toBe('available');
    expect(isVariantSelectable({ status: 'archived', stock_quantity: 8, alert_threshold: 5 })).toBe(false);
    expect(isVariantSelectable({ status: 'active', stock_quantity: 0, alert_threshold: 5 })).toBe(false);
    expect(isVariantSelectable({ status: 'active', stock_quantity: 3, alert_threshold: 5 })).toBe(true);
  });

  it('supports 2D/1D options without empty placeholders', () => {
    expect(buildVariantDisplayName({ color: 'Black', size: 'M' })).toBe('Black / M');
    expect(buildVariantDisplayName({ material: 'Wool' })).toBe('Wool');
    expect(buildVariantDisplayName({})).toBe('-');
  });
});
