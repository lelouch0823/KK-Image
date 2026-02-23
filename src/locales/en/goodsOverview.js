// Goods Overview Translations
export default {
    subtitle: 'Analyze order demand and supply chain status from confirmed orders',
    pipeline: {
        confirmed: 'To Order',
        production: 'In Production',
        shipping: 'In Transit',
        arrived: 'Arrived',
    },
    summary: {
        totalProducts: 'Products in Demand',
        totalDemand: 'Total Demand',
        shortageCount: 'Shortage Products',
    },
    orderCount: '{count} orders',
    unit: 'pcs',
    table: {
        name: 'Product',
        sku: 'SKU',
        brand: 'Brand',
        category: 'Category',
        stock: 'Stock',
        totalDemand: 'Total Demand',
        shortage: 'Shortage',
        status: 'Status',
    },
    status: {
        shortage: 'Shortage',
        warning: 'Low Stock',
        sufficient: 'Sufficient',
    },
    filter: {
        allBrands: 'All Brands',
        allCategories: 'All Categories',
        shortageOnly: 'Shortage Only',
    },
    sort: {
        shortage: 'Sort by Shortage',
        demand: 'Sort by Demand',
        name: 'Sort by Name',
    },
    export: 'Export CSV',
    empty: 'No products require ordering',
};
