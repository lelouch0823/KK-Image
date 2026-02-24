// Purchase Order translations (English)
export default {
  title: 'Procurement',
  subtitle: 'Manage overseas purchase orders, track freight/tariff allocation and order sync',

  status: {
    draft: 'Draft',
    ordered: 'Ordered from Overseas',
    shipping: 'In Transit',
    arrived: 'In Warehouse',
    completed: 'Settled',
    cancelled: 'Cancelled',
  },

  customerView: {
    production: 'Sourcing Overseas',
    shipping: 'Shipping to Warehouse',
    arrived: 'Arrived at Warehouse',
  },

  table: {
    poNo: 'PO Number',
    status: 'Status',
    itemCount: 'Items',
    totalGoodsCost: 'Goods Total',
    estimatedShipping: 'Est. Shipping',
    estimatedTariff: 'Est. Tariff',
    actualShipping: 'Actual Shipping',
    actualTariff: 'Actual Tariff',
    createdAt: 'Created',
    completedAt: 'Settled',
    product: 'Product',
    quantity: 'Qty',
    unitCost: 'Unit Cost',
  },

  detail: {
    title: 'PO Detail',
    basicInfo: 'Basic Info',
    costInfo: 'Cost Info',
    items: 'Items',
    linkedOrder: 'Linked Order',
    publicStock: 'Public Stock',
  },

  form: {
    remark: 'Notes',
    remarkPlaceholder: 'Supplier, logistics company, etc.',
    currency: 'Currency',
    allocationMethod: 'Allocation Method',
    byQuantity: 'By Quantity',
    byValue: 'By Value Ratio',
    estimatedShipping: 'Est. Shipping',
    estimatedTariff: 'Est. Tariff',
    actualShipping: 'Actual Shipping (fill on arrival)',
    actualTariff: 'Actual Tariff (fill on arrival)',
    unitCost: 'Unit Cost',
    quantity: 'Qty',
    itemList: 'Purchase Items',
    noItems: 'Add items using the buttons above',
    source: 'Source',
    sourceOrder: 'Order',
    sourceStock: 'Restock',
    quantityWarning: 'Below demand',
    confirmShortageTitle: 'Quantity Below Demand',
    confirmShortage: 'Some items have quantities below customer order demand. Continue creating?',
    confirmCreate: 'Confirm Create',
    itemsCount: 'items',
    totalQty: 'Total Qty',
  },

  action: {
    create: 'New Purchase Order',
    createFromOrders: 'Create from Orders',
    addItem: 'Add Item',
    addProduct: 'Add Product',
    linkOrders: 'Link Orders',
    removeItem: 'Remove',
    updateStatus: 'Change Status',
    allocate: 'Allocate Costs',
    viewSuggestions: 'View Suggestions',
    settle: 'Enter Actual Costs',
  },

  toast: {
    created: 'Purchase order created',
    createdFromOrders: 'PO created from customer orders',
    updated: 'Purchase order updated',
    statusUpdated: 'Status updated',
    itemsAdded: 'Items added',
    itemRemoved: 'Item removed',
    allocated: 'Cost allocation complete',
  },

  error: {
    loadFailed: 'Failed to load purchase orders',
    notFound: 'Purchase order not found',
  },

  suggestions: {
    title: 'Smart Suggestions',
    subtitle: 'Recommended items based on shortage analysis',
    shortage: 'Shortage',
    demand: 'Demand',
    stock: 'Stock',
    orders: 'Linked Orders',
    empty: 'No products matching procurement criteria',
    addSelected: 'Add Selected to PO',
  },

  // Pagination
  pagination: {
    total: '{count} total',
    prev: 'Previous',
    next: 'Next',
  },

  // Empty state
  empty: 'No purchase orders yet',
  emptyItems: 'No items',

  allocation: {
    freight: 'Freight',
    tariff: 'Tariff',
    landedCost: 'Landed Cost',
    perUnit: '/unit',
  },

  filter: {
    all: 'All',
    active: 'Active',
  },

  selection: {
    orderTitle: 'Select Orders',
    orderSubtitle: 'Select confirmed customer orders to link',
    searchOrder: 'Search order no, product, or customer...',
    productTitle: 'Select Products',
    productSubtitle: 'Add products for stock replenishment',
    searchProduct: 'Search product name or SKU...',
    selectedCount: '{count} selected',
    selectAll: 'Select All',
    deselectAll: 'Deselect All',
    emptyOrders: 'No confirmed orders available',
    recommendedBrand: 'Same Brand',
  },
};
