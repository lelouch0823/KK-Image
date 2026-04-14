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
  order_read_by_admin: {
    version: 1,
    consumers: ['cache'],
  },
  order_read_by_sales: {
    version: 1,
    consumers: ['cache'],
  },
  order_line_fulfillment_updated: {
    version: 1,
    consumers: ['cache'],
  },
  order_delivery_confirmed: {
    version: 1,
    consumers: ['cache', 'notification'],
  },
  order_return_created: {
    version: 1,
    consumers: ['cache', 'notification'],
  },
  order_return_restocked: {
    version: 1,
    consumers: ['cache', 'notification'],
  },
  purchase_order_created: {
    version: 1,
    consumers: ['cache'],
  },
  purchase_order_created_from_orders: {
    version: 1,
    consumers: ['cache'],
  },
  purchase_order_updated: {
    version: 1,
    consumers: ['cache'],
  },
  purchase_order_status_changed: {
    version: 1,
    consumers: ['cache'],
  },
  purchase_order_item_created: {
    version: 1,
    consumers: ['cache'],
  },
  purchase_order_item_updated: {
    version: 1,
    consumers: ['cache'],
  },
  purchase_order_item_deleted: {
    version: 1,
    consumers: ['cache'],
  },
  purchase_order_cost_allocated: {
    version: 1,
    consumers: ['cache'],
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
  customer_created: {
    version: 1,
    consumers: ['cache'],
  },
  customer_updated: {
    version: 1,
    consumers: ['cache'],
  },
  customer_deleted: {
    version: 1,
    consumers: ['cache'],
  },
  salesperson_created: {
    version: 1,
    consumers: ['cache'],
  },
  salesperson_updated: {
    version: 1,
    consumers: ['cache'],
  },
  salesperson_deleted: {
    version: 1,
    consumers: ['cache'],
  },
  salesperson_token_reset: {
    version: 1,
    consumers: ['cache'],
  },
  admin_notification_created: {
    version: 1,
    consumers: ['notification'],
  },
  notification_read_by_admin: {
    version: 1,
    consumers: ['cache'],
  },
  notification_read_by_sales: {
    version: 1,
    consumers: ['cache'],
  },
  tag_created: {
    version: 1,
    consumers: ['cache'],
  },
  tag_assigned_to_file: {
    version: 1,
    consumers: ['cache'],
  },
  tag_unassigned_from_file: {
    version: 1,
    consumers: ['cache'],
  },
  folder_created: {
    version: 1,
    consumers: ['cache'],
  },
  folder_updated: {
    version: 1,
    consumers: ['cache'],
  },
  folder_deleted: {
    version: 1,
    consumers: ['cache'],
  },
  file_uploaded: {
    version: 1,
    consumers: ['webhook'],
  },
  v1_folder_created: {
    version: 1,
    consumers: ['cache'],
  },
  v1_folder_updated: {
    version: 1,
    consumers: ['cache'],
  },
  v1_folder_deleted: {
    version: 1,
    consumers: ['cache'],
  },
  v1_folder_share_updated: {
    version: 1,
    consumers: ['cache'],
  },
  v1_file_created: {
    version: 1,
    consumers: ['cache'],
  },
  v1_file_updated: {
    version: 1,
    consumers: ['cache'],
  },
  v1_file_deleted: {
    version: 1,
    consumers: ['cache'],
  },
  v1_file_batch_deleted: {
    version: 1,
    consumers: ['cache'],
  },
  v1_file_batch_moved: {
    version: 1,
    consumers: ['cache'],
  },
  space_created: {
    version: 1,
    consumers: ['cache'],
  },
  space_updated: {
    version: 1,
    consumers: ['cache'],
  },
  space_deleted: {
    version: 1,
    consumers: ['cache'],
  },
  space_file_added: {
    version: 1,
    consumers: ['cache'],
  },
  space_file_removed: {
    version: 1,
    consumers: ['cache'],
  },
  space_file_reordered: {
    version: 1,
    consumers: ['cache'],
  },
  space_subspace_created: {
    version: 1,
    consumers: ['cache'],
  },
  product_created: {
    version: 1,
    consumers: ['cache'],
  },
  product_updated: {
    version: 1,
    consumers: ['cache'],
  },
  product_replaced: {
    version: 1,
    consumers: ['cache'],
  },
  product_archived: {
    version: 1,
    consumers: ['cache'],
  },
  product_batch_imported: {
    version: 1,
    consumers: ['cache'],
  },
  product_dimension_created: {
    version: 1,
    consumers: ['cache'],
  },
  product_dimension_updated: {
    version: 1,
    consumers: ['cache'],
  },
  product_dimension_archived: {
    version: 1,
    consumers: ['cache'],
  },
  product_dimension_value_created: {
    version: 1,
    consumers: ['cache'],
  },
  product_dimension_value_archived: {
    version: 1,
    consumers: ['cache'],
  },
  product_dimension_value_restored: {
    version: 1,
    consumers: ['cache'],
  },
  product_variant_image_created: {
    version: 1,
    consumers: ['cache'],
  },
  product_variant_image_sorted: {
    version: 1,
    consumers: ['cache'],
  },
  product_variant_image_primary_changed: {
    version: 1,
    consumers: ['cache'],
  },
  product_variant_image_deleted: {
    version: 1,
    consumers: ['cache'],
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
