import { describe, expect, it } from 'vitest';
import {
  applyBatchBuilderSelection,
  buildVariantsAfterDimensionArchive,
} from '../product-form/archives.js';

describe('product-form archive helpers', () => {
  it('dedupes variants after merge_keep dimension archive', () => {
    const variants = [
      { id: 'v1', options_values: { Color: 'Red', Size: 'M' } },
      { id: 'v2', options_values: { Color: 'Blue', Size: 'M' } },
      { id: 'v3', options_values: { Color: 'Red', Size: 'L' } },
    ];

    const result = buildVariantsAfterDimensionArchive({
      variants,
      archivedOption: { name: 'Color' },
      mode: 'merge_keep',
      removeDimensionFromVariant: (variant, option) => {
        const nextOptionsValues = { ...variant.options_values };
        delete nextOptionsValues[option.name];
        return { ...variant, options_values: nextOptionsValues };
      },
      getVariantOptionValue: (variant, option) => variant.options_values?.[option.name],
      buildVariantOptionsKey: (optionsValues) => JSON.stringify(optionsValues),
      markVariantCompleteness: (variant) => ({ ...variant, marked: true }),
      getNextDimensionNames: () => ['Size'],
    });

    expect(result).toEqual([
      { id: 'v1', options_values: { Size: 'M' }, marked: true },
      { id: 'v3', options_values: { Size: 'L' }, marked: true },
    ]);
  });

  it('normalizes batch builder options and appends only missing variants', () => {
    const existingVariants = [
      { id: 'v1', options_values: { Size: 'M' }, sku: 'sku-1' },
    ];

    const result = applyBatchBuilderSelection({
      existingVariants,
      options: [{ name: 'Size', values: ['M', 'L'] }],
      variants: [
        { id: 'v1', options_values: { Size: 'M' }, sku: 'sku-1' },
        { id: 'v2', options_values: { Size: 'L' }, sku: 2 },
      ],
      buildVariantOptionsKey: (optionsValues) => JSON.stringify(optionsValues),
      markVariantCompleteness: (variant) => ({ ...variant, marked: true }),
    });

    expect(result.options).toEqual([
      { name: 'Size', values: ['M', 'L'], inputValue: '' },
    ]);
    expect(result.variants).toEqual([
      existingVariants[0],
      { id: 'v2', options_values: { Size: 'L' }, sku: '2', marked: true },
    ]);
  });
});
