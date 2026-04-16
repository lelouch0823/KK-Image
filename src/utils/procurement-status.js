export const PROCUREMENT_STATUS_OPTIONS = [
  'none',
  'planned',
  'ordered',
  'partially_arrived',
  'arrived',
  'unprocured',
  'partially_procured',
  'fully_procured',
  'partially_received',
  'ready',
  'partially_shipped',
  'completed',
  'cancelled',
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
    unprocured: 'default',
    partially_procured: 'warning',
    fully_procured: 'info',
    partially_received: 'primary',
    ready: 'success',
    partially_shipped: 'primary',
    completed: 'success',
    cancelled: 'danger',
  };
  return map[normalized] || 'default';
};
