import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = process.cwd();

describe('useProductForm decomposition audit', () => {
  it('moves product-form pure helpers into dedicated modules', () => {
    const offenders = [];
    const mainPath = path.join(ROOT, 'src', 'composables', 'useProductForm.ts');
    const helperPaths = [
      path.join(ROOT, 'src', 'composables', 'product-form', 'helpers.ts'),
      path.join(ROOT, 'src', 'composables', 'product-form', 'dimensions.ts'),
      path.join(ROOT, 'src', 'composables', 'product-form', 'variants.ts'),
      path.join(ROOT, 'src', 'composables', 'product-form', 'archives.ts'),
      path.join(ROOT, 'src', 'composables', 'product-form', 'archive-actions.ts'),
      path.join(ROOT, 'src', 'composables', 'product-form', 'submission.ts'),
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

    if (!source.includes("@/composables/product-form/archive-actions.js")) {
      offenders.push('src/composables/useProductForm.js: missing product-form archive-actions import');
    }

    if (!source.includes("@/composables/product-form/submission.js")) {
      offenders.push('src/composables/useProductForm.js: missing product-form submission import');
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
      'const closeDimensionArchiveWizard = (force = false) => {',
      'const confirmDimensionArchive = async () => {',
      'const closeValueArchiveWizard = (force = false) => {',
      'const confirmValueArchive = async () => {',
      'const normalizeMutationResult = (result) => {',
      'const handleSubmit = async () => {',
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
