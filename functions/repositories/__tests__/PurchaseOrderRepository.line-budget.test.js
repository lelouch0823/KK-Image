import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

describe('PurchaseOrderRepository line budget', () => {
  it('keeps PurchaseOrderRepository under 560 lines', () => {
    const source = fs.readFileSync(
      path.resolve(process.cwd(), 'functions/repositories/PurchaseOrderRepository.js'),
      'utf8'
    );

    expect(source.split('\n').length).toBeLessThan(560);
  });
});
