import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

describe('PurchaseOrders line budget', () => {
  it('keeps PurchaseOrders route shell under 800 lines', () => {
    const source = fs.readFileSync(
      path.resolve(process.cwd(), 'src/views/PurchaseOrders.vue'),
      'utf8'
    );

    expect(source.split('\n').length).toBeLessThan(800);
  });
});
