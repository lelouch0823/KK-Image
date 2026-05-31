export const getProductStatusVariant = (status: any): string => {
  const map: Record<string, string> = {
    active: 'success',
    draft: 'neutral',
    archived: 'warning',
  };

  return map[status] || 'neutral';
};
