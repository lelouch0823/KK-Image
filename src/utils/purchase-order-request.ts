export function appendPurchaseOrderCacheBust(
  url: string,
  { forceRefresh = false, now = () => Date.now() }: { forceRefresh?: boolean; now?: () => number } = {}
): string {
  if (!forceRefresh) return url;
  const separator = url.includes('?') ? '&' : '?';
  return `${url}${separator}_ts=${now()}`;
}

export function buildPurchaseOrderIdempotentJsonHeaders(
  {
    createId = () =>
      globalThis.crypto?.randomUUID?.() ||
      `${Date.now()}-${Math.random().toString(36).slice(2)}`,
  }: { createId?: () => string } = {}
): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    'Idempotency-Key': createId(),
  };
}
