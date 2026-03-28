const STOCK_EVENT_TYPES = new Set([
  'purchase_received',
  'purchase_arrival',
  'manual_adjustment',
  'order_shipment',
  'inventory_correction',
]);

const RESERVATION_EVENT_TYPES = new Set([
  'inventory_reserved',
  'reservation_hold',
  'inventory_released',
  'reservation_release',
]);

function toNumber(value) {
  return Number(value) || 0;
}

function getEventType(event = {}) {
  return String(event.event_type || event.eventType || event.type || '').trim();
}

function getQuantityDelta(event = {}) {
  return toNumber(event.quantity_delta ?? event.quantityDelta ?? 0);
}

function getReservedDelta(event = {}) {
  if (event.reserved_delta != null) return toNumber(event.reserved_delta);
  if (event.reservedDelta != null) return toNumber(event.reservedDelta);
  return getQuantityDelta(event);
}

export function appendInventoryLedgerEvent(ledger = [], event = {}) {
  return [...ledger, { ...event }];
}

export function projectInventoryBalances(ledger = []) {
  const projection = ledger.reduce((acc, event) => {
    const eventType = getEventType(event);

    if (STOCK_EVENT_TYPES.has(eventType)) {
      acc.on_hand = Math.max(acc.on_hand + getQuantityDelta(event), 0);
    } else if (RESERVATION_EVENT_TYPES.has(eventType)) {
      acc.reserved = Math.max(acc.reserved + getReservedDelta(event), 0);
    }

    return acc;
  }, { on_hand: 0, reserved: 0 });

  return {
    on_hand: projection.on_hand,
    reserved: projection.reserved,
    available: Math.max(projection.on_hand - projection.reserved, 0),
  };
}
