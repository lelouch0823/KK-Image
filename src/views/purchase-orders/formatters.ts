export const formatDate = (ts: unknown): string => {
  if (!ts) return '—';
  return new Date(ts as string | number | Date).toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
};

export const formatDateTime = (ts: unknown): string => {
  if (!ts) return '—';
  return new Date(ts as string | number | Date).toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
};
