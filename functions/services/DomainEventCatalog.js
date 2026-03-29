export const DOMAIN_EVENT_CATALOG = {
  order_created_by_admin: {
    version: 1,
    consumers: ['cache', 'notification', 'webhook'],
  },
  order_created_by_sales: {
    version: 1,
    consumers: ['cache', 'notification', 'webhook'],
  },
  order_updated_by_admin: {
    version: 1,
    consumers: ['cache', 'notification'],
  },
  order_updated_by_sales: {
    version: 1,
    consumers: ['cache', 'notification'],
  },
  order_status_changed_by_admin: {
    version: 1,
    consumers: ['cache', 'notification'],
  },
  order_status_changed_by_sales: {
    version: 1,
    consumers: ['cache', 'notification'],
  },
  order_comment_created_by_admin: {
    version: 1,
    consumers: ['cache', 'notification'],
  },
  order_comment_created_by_sales: {
    version: 1,
    consumers: ['cache', 'notification'],
  },
  order_deleted_by_admin: {
    version: 1,
    consumers: ['cache'],
  },
  order_pending_reminder_due: {
    version: 1,
    consumers: ['notification'],
  },
  order_deadline_reminder_due: {
    version: 1,
    consumers: ['notification'],
  },
  purchase_receipt_recorded: {
    version: 1,
    consumers: ['audit', 'cache', 'notification', 'webhook'],
  },
  inventory_received: {
    version: 1,
    consumers: ['audit', 'cache'],
  },
  order_procurement_progressed: {
    version: 1,
    consumers: ['audit', 'cache', 'notification', 'webhook'],
  },
  purchase_receipt_reversed: {
    version: 1,
    consumers: ['audit', 'cache', 'notification', 'webhook'],
  },
  inventory_receipt_reversed: {
    version: 1,
    consumers: ['audit', 'cache', 'webhook'],
  },
  order_procurement_reversed: {
    version: 1,
    consumers: ['audit', 'cache', 'notification', 'webhook'],
  },
};

export function getDomainEventDefinition(eventType) {
  const normalizedEventType = String(eventType || '').trim();
  const definition = DOMAIN_EVENT_CATALOG[normalizedEventType];

  if (!definition) {
    throw new Error(`unknown domain event: ${normalizedEventType}`);
  }

  return definition;
}
