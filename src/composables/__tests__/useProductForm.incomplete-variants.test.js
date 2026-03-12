import { describe, expect, it } from 'vitest';
import { detectIncompleteVariant } from '../useProductForm.js';

describe('detectIncompleteVariant', () => {
  it('returns true when an existing variant no longer matches current dimension names', () => {
    const result = detectIncompleteVariant(
      ['Color', 'Size'],
      {
        id: 'variant-1',
        options_values: { Color: 'Black' },
      },
      true
    );

    expect(result).toBe(true);
  });

  it('returns false for new draft variants even if the options are incomplete', () => {
    const result = detectIncompleteVariant(
      ['Color', 'Size'],
      {
        _clientKey: 'variant-local',
        options_values: { Color: 'Black' },
      },
      true
    );

    expect(result).toBe(false);
  });

  it('returns false when the variant matches the current dimensions exactly', () => {
    const result = detectIncompleteVariant(
      ['Color', 'Size'],
      {
        id: 'variant-1',
        options_values: { Color: 'Black', Size: 'L' },
      },
      true
    );

    expect(result).toBe(false);
  });
});
