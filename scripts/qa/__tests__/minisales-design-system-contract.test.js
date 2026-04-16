import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const readSource = (relativePath) => readFileSync(resolve(process.cwd(), relativePath), 'utf8');

describe('minisales design-system contract', () => {
  it('keeps shared sales surfaces on shared tokens instead of raw hex values', () => {
    const orderSummary = readSource('minisales/miniprogram/components/sales/order-summary/index.scss');
    const orderLines = readSource('minisales/miniprogram/components/sales/order-lines/index.scss');

    expect(orderSummary).not.toContain('#0f172a');
    expect(orderSummary).not.toContain('#e2e8f0');
    expect(orderLines).not.toContain('#f8fafc');
  });
});
