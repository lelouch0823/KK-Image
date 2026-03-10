import { projectInventoryBalances } from '../../functions/services/InventoryService.js';

export function reconcileInventoryBalances(ledgerRows = [], persistedBalances = []) {
  const ledgerByVariant = new Map();

  for (const row of ledgerRows) {
    const variantId = String(row?.variant_id || '').trim();
    if (!variantId) continue;
    if (!ledgerByVariant.has(variantId)) ledgerByVariant.set(variantId, []);
    ledgerByVariant.get(variantId).push(row);
  }

  return persistedBalances.map((balance) => {
    const variantId = String(balance?.variant_id || '').trim();
    const expected = projectInventoryBalances(ledgerByVariant.get(variantId) || []);
    const actual = {
      on_hand: Number(balance?.on_hand || 0),
      reserved: Number(balance?.reserved || 0),
      available: Number(balance?.available || 0),
    };

    return {
      variant_id: variantId,
      matches: (
        actual.on_hand === expected.on_hand &&
        actual.reserved === expected.reserved &&
        actual.available === expected.available
      ),
      expected,
      actual,
    };
  });
}
