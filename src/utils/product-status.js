export const getProductStatusVariant = (status) => {
  const map = {
    active: 'success',
    draft: 'neutral',
    archived: 'warning',
  };

  return map[status] || 'neutral';
};
