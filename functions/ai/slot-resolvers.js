function normalizeComparable(value = '') {
  return String(value || '').trim().toLowerCase();
}

function buildCandidateResult(candidates = [], rawValue = '') {
  return {
    kind: 'candidates',
    rawValue,
    candidates,
  };
}

function pickVariantOptionValue(optionsValues = {}, aliases = []) {
  const entries = Object.entries(optionsValues || {});
  for (const alias of aliases) {
    const target = normalizeComparable(alias);
    const found = entries.find(([key]) => normalizeComparable(key) === target);
    if (found && String(found[1] || '').trim()) {
      return String(found[1]).trim();
    }
  }
  return '';
}

export async function resolveOrderProductSlot(rawValue, slots = {}, { productRepo } = {}) {
  const existing = String(rawValue || '').trim();
  if (existing) return existing;

  const productName = String(slots.productName || '').trim();
  if (!productName || !productRepo?.search) return rawValue;

  const result = await productRepo.search({
    search: productName,
    page: 1,
    limit: 5,
    status: 'active',
  });
  const items = Array.isArray(result?.items) ? result.items : [];
  if (items.length === 1) return items[0].id;
  if (items.length > 1) {
    return buildCandidateResult(items.map((item) => ({
      value: item.id,
      label: item.name || item.spu || item.id,
      description: [item.brand, item.spu].filter(Boolean).join(' / '),
    })), productName);
  }
  return rawValue;
}

export async function resolveOrderVariantSlot(rawValue, slots = {}, { variantRepo } = {}) {
  const existing = String(rawValue || '').trim();
  if (existing) return existing;

  const productId = String(slots.productId || '').trim();
  if (!productId || !variantRepo?.findByProductId) return rawValue;

  const color = String(slots.color || '').trim();
  const size = String(slots.size || '').trim();
  const sku = String(slots.sku || '').trim();
  if (!color && !size && !sku) return rawValue;

  const variants = await variantRepo.findByProductId(productId);
  const activeVariants = (variants || []).filter((variant) => String(variant.status || '').toLowerCase() === 'active');
  const matched = activeVariants.filter((variant) => {
    if (sku && normalizeComparable(variant.sku) !== normalizeComparable(sku)) return false;
    const variantColor = pickVariantOptionValue(variant.options_values, ['color', '颜色', '顏色']);
    const variantSize = pickVariantOptionValue(variant.options_values, ['size', '尺码', '尺碼']);
    if (color && normalizeComparable(variantColor) !== normalizeComparable(color)) return false;
    if (size && normalizeComparable(variantSize) !== normalizeComparable(size)) return false;
    return true;
  });

  if (matched.length === 1) return matched[0].id;
  if (matched.length > 1) {
    return buildCandidateResult(matched.map((variant) => ({
      value: variant.id,
      label: variant.sku || variant.id,
      description: [variantColorSummary(variant), variant.sku].filter(Boolean).join(' / '),
    })), `${color} ${size}`.trim());
  }
  return rawValue;
}

export async function resolvePurchaseOrderItemsSlot(items, { variantRepo } = {}) {
  if (!Array.isArray(items) || !variantRepo?.searchForAI) return items;
  const resolved = [];

  for (const item of items) {
    if (item?.product_id && item?.variant_id) {
      resolved.push(item);
      continue;
    }

    const query = String(item?.variant_query || '').trim();
    if (!query) {
      resolved.push(item);
      continue;
    }

    const search = await variantRepo.searchForAI({ search: query, limit: 5 });
    if (Array.isArray(search?.items) && search.items.length === 1) {
      const matched = search.items[0];
      resolved.push({
        ...item,
        product_id: matched.product_id,
        variant_id: matched.id,
        unit_cost: item.unit_cost ?? matched.cost_price ?? 0,
      });
      continue;
    }

    if (items.length === 1 && Array.isArray(search?.items) && search.items.length > 1) {
      return buildCandidateResult(search.items.map((matched) => ({
        value: [{
          ...item,
          product_id: matched.product_id,
          variant_id: matched.id,
          unit_cost: item.unit_cost ?? matched.cost_price ?? 0,
        }],
        label: [
          matched.product?.name || matched.product_name || query,
          matched.variantLabel || matched.sku || matched.id,
        ].filter(Boolean).join(' / '),
        description: [
          matched.product?.brand || matched.product_brand,
          matched.sku,
        ].filter(Boolean).join(' / '),
      })), query);
    }

    resolved.push(item);
  }

  return resolved;
}

function variantColorSummary(variant = {}) {
  const color = pickVariantOptionValue(variant.options_values, ['color', '颜色', '顏色']);
  const size = pickVariantOptionValue(variant.options_values, ['size', '尺码', '尺碼']);
  return [color, size].filter(Boolean).join(' / ');
}

export async function resolveSalespersonSlot(rawValue, _slots = {}, { salespersonRepo } = {}) {
  const query = String(rawValue || '').trim();
  if (!query || !salespersonRepo?.list) return rawValue;

  const result = await salespersonRepo.list({ page: 1, limit: 10, search: query });
  const items = Array.isArray(result?.results) ? result.results : [];
  if (items.length === 1) return items[0].id;
  if (items.length > 1) {
    return buildCandidateResult(items.map((item) => ({
      value: item.id,
      label: item.name || item.id,
      description: item.store || item.phone || '',
    })), query);
  }
  return rawValue;
}
