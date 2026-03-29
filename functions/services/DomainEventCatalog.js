export const DOMAIN_EVENT_CATALOG = {
  purchase_receipt_recorded: {
    version: 1,
    consumers: ['audit', 'cache', 'notification'],
  },
  inventory_received: {
    version: 1,
    consumers: ['audit', 'cache'],
  },
  order_procurement_progressed: {
    version: 1,
    consumers: ['audit', 'cache', 'notification'],
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
