import { describe, expect, it, vi } from 'vitest';
import { useOrderForm } from '@/composables/useOrderForm';

vi.mock('@/composables/useI18n', () => ({
  useI18n: () => ({ t: (key) => key }),
}));

vi.mock('@/composables/useRecentInputs', () => ({
  useRecentInputs: () => ({
    getRecent: () => [],
    saveMultiple: vi.fn(),
  }),
}));

vi.mock('@/composables/useSalesToken', () => ({
  useSalesToken: () => ({ token: { value: 'sales-token' } }),
}));

describe('useOrderForm multiline helpers', () => {
  it('derives summary metrics and copies a line with quantity reset', () => {
    const state = useOrderForm({ isSalesMode: false });

    state.fillForm({
      files: [{ id: 'file-1', url: '/file-1' }],
      lines: [
        { name: 'Desk', sku: 'SKU-DESK', quantity: 2 },
        { sku: 'SKU-PENDING', quantity: 3 },
      ],
    });

    expect(state.summaryMetrics.value.lineCount).toBe(2);
    expect(state.summaryMetrics.value.totalQuantity).toBe(5);
    expect(state.summaryMetrics.value.pendingLineCount).toBe(1);

    state.copyLine(0);

    expect(state.lines.value).toHaveLength(3);
    expect(state.lines.value[1]).toMatchObject({
      name: 'Desk',
      sku: 'SKU-DESK',
      quantity: 1,
    });

    state.updateLine(1, {
      ...state.lines.value[1],
      name: 'Desk Pro',
    });
    state.updateLine(2, {
      ...state.lines.value[2],
      name: 'Chair',
    });

    expect(state.summaryMetrics.value.pendingLineCount).toBe(0);

    expect(state.getSubmitData()).toMatchObject({
      name: 'Desk',
      quantity: 6,
      fileIds: ['file-1'],
      lines: [
        expect.objectContaining({ name: 'Desk', quantity: 2, sku: 'SKU-DESK' }),
        expect.objectContaining({ name: 'Desk Pro', quantity: 1, sku: 'SKU-DESK' }),
        expect.objectContaining({ name: 'Chair', quantity: 3, sku: 'SKU-PENDING' }),
      ],
    });
  });
});
