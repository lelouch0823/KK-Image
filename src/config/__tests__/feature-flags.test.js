import { describe, expect, it } from 'vitest';
import { featureFlags, isSalesOrderV2Enabled, resolveSalesOrderEntry } from '../feature-flags.js';

describe('feature flags', () => {
  it('exposes a boolean feature flag snapshot', () => {
    expect(typeof featureFlags.SALES_ORDER_V2).toBe('boolean');
  });

  it('defaults to refactor mode for the current flag snapshot', () => {
    expect(resolveSalesOrderEntry()).toBe('refactor');
    expect(isSalesOrderV2Enabled()).toBe(true);
  });

  it('resolves provided flag objects without relying on env state', () => {
    expect(resolveSalesOrderEntry({ SALES_ORDER_V2: false })).toBe('legacy');
    expect(isSalesOrderV2Enabled({ SALES_ORDER_V2: false })).toBe(false);

    expect(resolveSalesOrderEntry({ SALES_ORDER_V2: true })).toBe('refactor');
    expect(isSalesOrderV2Enabled({ SALES_ORDER_V2: true })).toBe(true);
  });

  it('treats truthy and falsy values consistently when flag objects are passed in', () => {
    expect(resolveSalesOrderEntry({ SALES_ORDER_V2: 1 })).toBe('refactor');
    expect(resolveSalesOrderEntry({ SALES_ORDER_V2: 0 })).toBe('legacy');
  });
});
