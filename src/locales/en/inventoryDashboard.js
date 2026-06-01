// Inventory Dashboard Translations
export default {
  title: 'Inventory Dashboard',
  subtitle: 'Monitor inventory levels in real-time, detect low-stock and zero-stock risks',

  // Summary cards
  summary: {
    totalSkus: 'Active SKUs',
    lowStock: 'Low Stock',
    zeroStock: 'Zero Stock',
    inventoryValue: 'Inventory Value',
  },

  // Low stock table
  lowStock: {
    title: 'Low Stock Alerts',
    empty: 'No low-stock items',
    table: {
      product: 'Product',
      sku: 'SKU',
      variant: 'Variant',
      available: 'Available',
      onHand: 'On Hand',
      reserved: 'Reserved',
      threshold: 'Threshold',
    },
  },

  // Zero stock table
  zeroStock: {
    title: 'Zero Stock Items',
    empty: 'No zero-stock items',
    table: {
      product: 'Product',
      sku: 'SKU',
      variant: 'Variant',
      onHand: 'On Hand',
      reserved: 'Reserved',
    },
  },

  // Recent movements
  movements: {
    title: 'Recent Inventory Movements',
    empty: 'No inventory movements',
    table: {
      product: 'Product',
      sku: 'SKU',
      type: 'Type',
      delta: 'Quantity',
      time: 'Time',
    },
    eventType: {
      purchase_ordered: 'Purchase Ordered',
      purchase_received: 'Purchase Received',
      purchase_arrival: 'Purchase Arrival',
      inventory_allocated_to_order_line: 'Allocated to Order',
      inventory_deallocated_from_order_line: 'Deallocated from Order',
      inventory_reserved: 'Reserved',
      reservation_hold: 'Reservation Hold',
      inventory_released: 'Released',
      reservation_release: 'Reservation Release',
      order_shipment: 'Order Shipment',
      order_unshipment: 'Shipment Reversed',
      order_return_restock: 'Return Restock',
      order_line_cancelled: 'Order Line Cancelled',
      inventory_adjusted_reversal: 'Adjustment Reversal',
      manual_adjustment: 'Manual Adjustment',
    },
  },

  // Top moving items
  topMoving: {
    title: 'Top Moving Items (30 Days)',
    empty: 'No outbound data',
    table: {
      product: 'Product',
      sku: 'SKU',
      variant: 'Variant',
      outbound: 'Outbound',
    },
  },

  // Permission
  permissionDenied: 'Permission Denied for Inventory Dashboard',
  permissionDeniedDesc: 'Your account does not have inventory dashboard access. Please contact the admin to assign products:manage.',
};
