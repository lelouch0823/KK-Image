export function reconcileVariantSelection({ currentItems = [], selectedVariants = [], selectedVariantIds = [] } = {}) {
  const manualItems = (currentItems || []).filter((item) => !item.pre_order_id && item.variant_id);
  const selectedIdSet = new Set(
    ((selectedVariantIds && selectedVariantIds.length > 0)
      ? selectedVariantIds
      : (selectedVariants || []).map((variant) => variant?.variant_id))
      .filter(Boolean)
  );
  const selectedByVariantId = new Map(
    (selectedVariants || [])
      .filter((variant) => variant?.variant_id)
      .map((variant) => [variant.variant_id, variant])
  );

  const toRemove = manualItems.filter((item) => !selectedIdSet.has(item.variant_id));
  const toRemoveVariantIds = toRemove.map((item) => item.variant_id).filter(Boolean);
  const toRemoveItemIds = toRemove.map((item) => item.id).filter(Boolean);

  const manualVariantIds = new Set(manualItems.map((item) => item.variant_id));
  const toAdd = Array.from(selectedByVariantId.values())
    .filter((variant) => !manualVariantIds.has(variant.variant_id))
    .map((variant) => ({
      product_id: variant.product_id,
      variant_id: variant.variant_id,
      pre_order_id: null,
      quantity: 1,
      unit_cost: Number(variant.unit_cost || 0),
      product_name: variant.product_name || '—',
      sku: variant.sku || '—',
      brand: variant.brand || '',
      image: variant.image || null,
      moq: variant.moq || null,
      pack_size: variant.pack_size || null,
      order_step: variant.order_step || null,
      required_quantity: null,
    }));

  return {
    toAdd,
    toRemoveVariantIds,
    toRemoveItemIds,
  };
}

export function countUnavailableSelectedVariants(initialSelectedVariantIds = [], activeVariants = []) {
  const activeIds = new Set((activeVariants || []).map((variant) => variant.variant_id).filter(Boolean));
  return (initialSelectedVariantIds || []).filter((id) => id && !activeIds.has(id)).length;
}
