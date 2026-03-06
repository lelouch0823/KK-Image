import { describe, expect, it } from 'vitest';
import {
  PO_TO_PROCUREMENT_STATUS_MAP,
  isTerminalOrderStatus,
  canApplyProcurementStatus,
} from '../order-procurement-state-machine.js';

describe('order-procurement-state-machine', () => {
  it('maps PO status to procurement status', () => {
    expect(PO_TO_PROCUREMENT_STATUS_MAP.ordered).toBe('ordered');
    expect(PO_TO_PROCUREMENT_STATUS_MAP.shipping).toBe('ordered');
    expect(PO_TO_PROCUREMENT_STATUS_MAP.arrived).toBe('arrived');
  });

  it('blocks terminal order status from auto cascade', () => {
    expect(isTerminalOrderStatus('delivered')).toBe(true);
    expect(canApplyProcurementStatus('void', 'ordered')).toBe(false);
  });
});
