import { describe, expect, it } from 'vitest';
import { useI18n } from '../useI18n';

describe('useI18n fallback behavior', () => {
  it('returns fallback string when translation key is missing', () => {
    const { t } = useI18n();
    expect(t('not.exist', 'Fallback')).toBe('Fallback');
  });

  it('returns translation value instead of fallback for existing key', () => {
    const { t } = useI18n();
    expect(t('ai.assistant', 'Fallback')).not.toBe('Fallback');
  });
});
