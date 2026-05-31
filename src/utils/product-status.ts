export const getProductStatusVariant = (status: unknown): string => {
  const map: Record<string, string> = {
    active: 'success',
    draft: 'neutral',
    archived: 'warning',
  };

  return typeof status === 'string' ? (map[status] || 'neutral') : 'neutral';
};
