import { CURRENCY_CODE_SET } from '@/constants/currency';

export function normalizeCurrencyCode(value) {
  const code = String(value || '').trim().toUpperCase();
  return CURRENCY_CODE_SET.has(code) ? code : 'CNY';
}

export function formatSubmittedCurrency(value) {
  const code = String(value || '').trim().toUpperCase();
  return code || 'CNY';
}

export function isExistingVariantInEditMode(editModeRef, variant) {
  return Boolean(editModeRef?.value && variant?.id);
}

function normalizeOptionKeys(optionsValues) {
  return Object.keys(optionsValues || {})
    .map((key) => String(key || '').trim())
    .filter(Boolean)
    .sort();
}

export function detectIncompleteVariant(activeDimensionNames = [], variant = {}, isEditMode = false) {
  if (!isEditMode || !variant?.id) return false;
  const activeKeys = [...new Set((activeDimensionNames || []).map((name) => String(name || '').trim()).filter(Boolean))].sort();
  const variantKeys = normalizeOptionKeys(variant.options_values);
  if (activeKeys.length === 0) return false;
  if (variantKeys.length !== activeKeys.length) return true;
  return activeKeys.some((key, index) => key !== variantKeys[index]);
}

function translateWithFallback(translate, key, params, fallback) {
  const resolved = typeof translate === 'function' ? translate(key, params) : '';
  if (!resolved || resolved === key) return fallback;
  return resolved;
}

export function buildVariantSyncSummaryMessage(sync = {}, translate) {
  const created = Math.max(0, Number(sync.created ?? 0));
  const updated = Math.max(0, Number(sync.updated ?? 0));
  const archived = Math.max(0, Number(sync.archived ?? 0));
  const reactivated = Math.max(0, Number(sync.reactivated ?? 0));

  const parts = [];
  if (created > 0) {
    parts.push(
      translateWithFallback(
        translate,
        'product.form.variant_sync_created',
        { count: created },
        `Created ${created} variants`
      )
    );
  }
  if (updated > 0) {
    parts.push(
      translateWithFallback(
        translate,
        'product.form.variant_sync_updated',
        { count: updated },
        `Updated ${updated} variants`
      )
    );
  }
  if (archived > 0) {
    parts.push(
      translateWithFallback(
        translate,
        'product.form.variant_sync_archived',
        { count: archived },
        `Archived ${archived} variants`
      )
    );
  }
  if (reactivated > 0) {
    parts.push(
      translateWithFallback(
        translate,
        'product.form.variant_sync_reactivated',
        { count: reactivated },
        `Reactivated ${reactivated} variants`
      )
    );
  }

  if (parts.length === 0) {
    return translateWithFallback(
      translate,
      'product.form.variant_sync_no_changes',
      {},
      'Variants synced with no quantity changes'
    );
  }

  return translateWithFallback(
    translate,
    'product.form.variant_sync_summary_readable',
    { details: parts.join('，') },
    `Variants synced: ${parts.join(', ')}`
  );
}
