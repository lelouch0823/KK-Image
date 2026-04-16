import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const readSource = (relativePath) => readFileSync(resolve(process.cwd(), relativePath), 'utf8');

describe('minisales design-system contract', () => {
  it('keeps shared sales surfaces on shared tokens instead of raw hex values', () => {
    const orderSummary = readSource('minisales/miniprogram/components/sales/order-summary/index.scss');
    const orderLines = readSource('minisales/miniprogram/components/sales/order-lines/index.scss');
    const orderCard = readSource('minisales/miniprogram/components/sales/order-card/index.scss');
    const productBinding = readSource(
      'minisales/miniprogram/components/sales/product-binding/index.scss'
    );
    const timelineCard = readSource(
      'minisales/miniprogram/components/sales/timeline-card/index.scss'
    );

    expect(orderSummary).not.toContain('#0f172a');
    expect(orderSummary).not.toContain('#e2e8f0');
    expect(orderLines).not.toContain('#f8fafc');
    expect(orderCard).not.toContain('#ffffff');
    expect(productBinding).not.toContain('#ffffff');
    expect(productBinding).not.toContain('#dbeafe');
    expect(productBinding).not.toContain('rgba(15, 23, 42, 0.32)');
    expect(timelineCard).not.toContain('#e2e8f0');
    expect(timelineCard).not.toContain('rgba(59, 130, 246, 0.12)');
  });
});
