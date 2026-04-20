import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = process.cwd();
const TARGETS = [
  'src/utils/sales-space.js',
  'src/composables/useProductForm.js',
  'src/components/product/ProductDetail.vue',
  'src/views/sales/SalesFormView.vue',
  'src/components/OrderEditModal.vue',
  'src/composables/useUploadQueue.js',
];

describe('frontend json parse helper dedup audit', () => {
  it('reuses shared frontend json helpers in targeted modules', () => {
    const offenders = [];

    for (const relativePath of TARGETS) {
      const fullPath = path.join(ROOT, relativePath);
      const source = fs.readFileSync(fullPath, 'utf8');

      if (source.includes('JSON.parse(')) {
        offenders.push(`${relativePath}: still calls JSON.parse directly`);
      }

      if (!source.includes('@/utils/json') && !source.includes("../utils/json") && !source.includes('./json')) {
        offenders.push(`${relativePath}: missing shared json helper import`);
      }
    }

    expect(
      offenders,
      `frontend json dedup offenders:\n${offenders.join('\n')}`
    ).toEqual([]);
  });
});
