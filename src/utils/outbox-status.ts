/**
 * 将 outbox 事件状态映射为 StatusBadge variant
 * @param status - 事件状态
 * @returns StatusBadge variant 名称
 */
export function resolveVariant(status: string): 'danger' | 'warning' | 'success' | 'default' | 'primary' {
  if (status === 'failed') return 'danger';
  if (status === 'pending' || status === 'processing') return 'warning';
  if (status === 'published') return 'success';
  if (status === 'skipped') return 'default';
  return 'primary';
}
