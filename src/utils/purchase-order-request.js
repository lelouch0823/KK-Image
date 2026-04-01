export function appendPurchaseOrderCacheBust(
  url,
  { forceRefresh = false, now = () => Date.now() } = {}
) {
  if (!forceRefresh) return url;
  const separator = url.includes('?') ? '&' : '?';
  return `${url}${separator}_ts=${now()}`;
}

export function buildPurchaseOrderIdempotentJsonHeaders(
  {
    createId = () =>
      globalThis.crypto?.randomUUID?.() ||
      `${Date.now()}-${Math.random().toString(36).slice(2)}`,
  } = {}
) {
  return {
    'Content-Type': 'application/json',
    'Idempotency-Key': createId(),
  };
}
