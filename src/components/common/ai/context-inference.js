export function normalizeString(value) {
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  return normalized || null;
}

export function inferCurrentView(routePath = '') {
  if (typeof routePath === 'string' && routePath.startsWith('/admin/')) {
    return routePath.replace('/admin/', '');
  }
  return 'dashboard';
}

export function inferAIEntityContext({ view, params = {}, query = {} } = {}) {
  const variantId = normalizeString(query.variantId);
  if (variantId) return { selectedId: variantId, selectedType: 'variant' };

  const productId = normalizeString(query.productId);
  if (productId) return { selectedId: productId, selectedType: 'product' };

  const orderId = normalizeString(query.orderId);
  if (orderId) return { selectedId: orderId, selectedType: 'order' };

  const customerId = normalizeString(query.customerId);
  if (customerId) return { selectedId: customerId, selectedType: 'customer' };

  const id = normalizeString(params.id) || normalizeString(query.id);
  if (!id) return { selectedId: null, selectedType: null };

  if (view === 'orders') return { selectedId: id, selectedType: 'order' };
  if (view === 'products') return { selectedId: id, selectedType: 'product' };
  if (view === 'customers') return { selectedId: id, selectedType: 'customer' };
  if (view === 'goods-overview') return { selectedId: id, selectedType: 'variant' };
  return { selectedId: id, selectedType: null };
}
