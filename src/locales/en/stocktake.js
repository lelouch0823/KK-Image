// Stocktake translations
export default {
  title: 'Stocktake',
  subtitle: 'Create stocktake tasks, record actual counts, and adjust inventory',

  // Stocktake status
  status: {
    draft: 'Draft',
    counting: 'Counting',
    adjusted: 'Adjusted',
    cancelled: 'Cancelled',
  },

  // Summary
  summary: {
    total: 'Total Stocktakes',
    counting: 'In Progress',
    adjusted: 'Completed',
    diffItems: 'Diff Items',
  },

  // Table columns
  table: {
    id: 'Stocktake ID',
    status: 'Status',
    itemCount: 'Items',
    countedItems: 'Counted',
    diffItems: 'Diffs',
    createdAt: 'Created At',
    completedAt: 'Completed At',
    notes: 'Notes',
  },

  // Detail table
  detail: {
    title: 'Stocktake Details',
    product: 'Product',
    sku: 'SKU',
    variant: 'Variant',
    systemQty: 'System Qty',
    actualQty: 'Actual Qty',
    difference: 'Difference',
    notes: 'Notes',
    noItems: 'No stocktake items',
    counted: 'Counted',
    total: '{count} items total',
  },

  // Actions
  action: {
    create: 'New Stocktake',
    save: 'Save',
    adjust: 'Adjust Inventory',
    cancel: 'Cancel Stocktake',
    print: 'Print Report',
    back: 'Back to List',
    confirmAdjust: 'Confirm Adjustment',
    confirmCancel: 'Confirm Cancel',
  },

  // Confirmation dialogs
  confirm: {
    adjustTitle: 'Confirm Inventory Adjustment',
    adjustMessage: 'This will adjust system inventory based on stocktake differences. This action cannot be undone. Continue?',
    cancelTitle: 'Cancel Stocktake',
    cancelMessage: 'Are you sure you want to cancel this stocktake? This cannot be undone.',
  },

  // Toast messages
  toast: {
    created: 'Stocktake created',
    updated: 'Stocktake items saved',
    adjusted: 'Inventory adjusted',
    cancelled: 'Stocktake cancelled',
    adjustFailed: 'Inventory adjustment failed',
    noDifference: 'No differences to adjust',
  },

  // Form
  form: {
    notes: 'Notes',
    notesPlaceholder: 'Optional stocktake notes',
    actualQtyPlaceholder: 'Enter actual quantity',
  },

  // Pagination
  pagination: {
    total: '{count} items',
    prev: 'Previous',
    next: 'Next',
  },

  // Empty state
  empty: 'No stocktakes yet',
  emptyHint: 'Click "New Stocktake" to start',

  // Filter
  filter: {
    all: 'All',
    draft: 'Draft',
    counting: 'Counting',
    adjusted: 'Adjusted',
    cancelled: 'Cancelled',
  },
};
