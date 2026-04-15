import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = process.cwd();

describe('useProductForm decomposition audit', () => {
  it('moves product-form pure helpers into dedicated modules', () => {
    const offenders = [];
    const mainPath = path.join(ROOT, 'src', 'composables', 'useProductForm.js');
    const helperPaths = [
      path.join(ROOT, 'src', 'composables', 'product-form', 'helpers.js'),
      path.join(ROOT, 'src', 'composables', 'product-form', 'dimensions.js'),
      path.join(ROOT, 'src', 'composables', 'product-form', 'variants.js'),
      path.join(ROOT, 'src', 'composables', 'product-form', 'archives.js'),
    ];
    const source = fs.readFileSync(mainPath, 'utf8');

    for (const helperPath of helperPaths) {
      if (!fs.existsSync(helperPath)) {
        offenders.push(`${path.relative(ROOT, helperPath)}: missing extracted helper module`);
      }
    }

    if (!source.includes("@/composables/product-form/helpers.js")) {
      offenders.push('src/composables/useProductForm.js: missing product-form helper import');
    }

    if (!source.includes("@/composables/product-form/dimensions.js")) {
      offenders.push('src/composables/useProductForm.js: missing product-form dimensions import');
    }

    if (!source.includes("@/composables/product-form/variants.js")) {
      offenders.push('src/composables/useProductForm.js: missing product-form variant helper import');
    }

    if (!source.includes("@/composables/product-form/archives.js")) {
      offenders.push('src/composables/useProductForm.js: missing product-form archive helper import');
    }

    for (const marker of [
      'function normalizeCurrencyCode(',
      'function toOptionModel(',
      'function buildOptionsFromDimensions(',
      'function buildDimensionNameLookup(',
      'const nextVariantLocalKey = () => {',
      'const ensureVariantLocalKey = (variant = {}) => ({',
      'const getNextDimensionNames = () =>',
      'const getVariantOptionValue = (variant, option) => {',
      'const removeDimensionFromVariant = (variant, option) => {',
      'const variantOptionsKey = (optionsValues) =>',
      'const handleBatchBuilderApply = ({ options = [], variants = [] }) => {',
    ]) {
      if (source.includes(marker)) {
        offenders.push(`src/composables/useProductForm.js: still defines ${marker}`);
      }
    }

    expect(
      offenders,
      `useProductForm decomposition offenders:\n${offenders.join('\n')}`
    ).toEqual([]);
  });
});
