import { describe, expect, it } from 'vitest';
import { buildVariantSyncSummaryMessage } from '../useProductForm.js';

const createTranslator = () => {
  const dictionary = {
    'product.form.variant_sync_summary_readable': ({ details }) => `规格同步完成：${details}`,
    'product.form.variant_sync_created': ({ count }) => `新增 ${count} 个规格`,
    'product.form.variant_sync_updated': ({ count }) => `更新 ${count} 个规格`,
    'product.form.variant_sync_archived': ({ count }) => `归档 ${count} 个规格`,
    'product.form.variant_sync_reactivated': ({ count }) => `恢复 ${count} 个规格`,
    'product.form.variant_sync_no_changes': () => '规格同步完成，未检测到数量变动',
  };
  return (key, params = {}) => {
    const item = dictionary[key];
    if (typeof item === 'function') return item(params);
    return item || key;
  };
};

describe('buildVariantSyncSummaryMessage', () => {
  it('renders readable summary with only non-zero entries', () => {
    const t = createTranslator();
    const message = buildVariantSyncSummaryMessage(
      { created: 0, updated: 4, archived: 0, reactivated: 0 },
      t
    );
    expect(message).toBe('规格同步完成：更新 4 个规格');
  });

  it('renders full summary when multiple counters changed', () => {
    const t = createTranslator();
    const message = buildVariantSyncSummaryMessage(
      { created: 2, updated: 4, archived: 1, reactivated: 1 },
      t
    );
    expect(message).toBe(
      '规格同步完成：新增 2 个规格，更新 4 个规格，归档 1 个规格，恢复 1 个规格'
    );
  });

  it('renders no-change message when all counters are zero', () => {
    const t = createTranslator();
    const message = buildVariantSyncSummaryMessage(
      { created: 0, updated: 0, archived: 0, reactivated: 0 },
      t
    );
    expect(message).toBe('规格同步完成，未检测到数量变动');
  });
});
