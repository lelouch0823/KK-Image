export const PROCUREMENT_STATUS_OPTIONS = [
  'none',
  'planned',
  'ordered',
  'partially_arrived',
  'arrived',
];

export const normalizeProcurementStatus = (status) => {
  if (!status) return 'none';
  return PROCUREMENT_STATUS_OPTIONS.includes(status) ? status : 'none';
};

export const getProcurementStatusVariant = (status) => {
  const normalized = normalizeProcurementStatus(status);
  const map = {
    none: 'default',
    planned: 'warning',
    ordered: 'info',
    partially_arrived: 'primary',
    arrived: 'success',
  };
  return map[normalized] || 'default';
};
