import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = process.cwd();

describe('currency constants ownership audit', () => {
  it('defines currency constants outside useProductForm and consumes the shared module directly', async () => {
    const offenders = [];
    const currencyPath = path.join(ROOT, 'src/constants/currency.ts');

    if (!fs.existsSync(currencyPath)) {
      offenders.push('src/constants/currency.ts: missing shared currency constants module');
    }

    const useProductFormSource = fs.readFileSync(
      path.join(ROOT, 'src/composables/useProductForm.ts'),
      'utf8'
    );
    if (useProductFormSource.includes('export const CURRENCY_OPTIONS')) {
      offenders.push('src/composables/useProductForm.ts: still defines CURRENCY_OPTIONS');
    }
    if (useProductFormSource.includes('export const CURRENCY_SYMBOLS')) {
      offenders.push('src/composables/useProductForm.ts: still defines CURRENCY_SYMBOLS');
    }

    const purchaseOrdersSource = fs.readFileSync(
      path.join(ROOT, 'src/views/PurchaseOrders.vue'),
      'utf8'
    );
    if (purchaseOrdersSource.includes('@/composables/useProductForm')) {
      offenders.push(
        'src/views/PurchaseOrders.vue: still imports currency constants from useProductForm'
      );
    }

    const productCreateModalSource = fs.readFileSync(
      path.join(ROOT, 'src/components/product/ProductCreateModal.vue'),
      'utf8'
    );
    const useProductFormDestructure =
      productCreateModalSource.match(/const\s*\{[\s\S]*?\}\s*=\s*useProductForm\(/m)?.[0] || '';
    if (
      useProductFormDestructure.includes('CURRENCY_OPTIONS') ||
      useProductFormDestructure.includes('CURRENCY_SYMBOLS')
    ) {
      offenders.push(
        'src/components/product/ProductCreateModal.vue: still sources currency constants from useProductForm return value'
      );
    }

    expect(offenders, `currency ownership offenders:\n${offenders.join('\n')}`).toEqual([]);
  });
});
