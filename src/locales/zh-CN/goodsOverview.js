// 订货总览 翻译 (Goods Overview)
export default {
    subtitle: '根据已确认订单分析订货需求与供应链状态',
    pipeline: {
        confirmed: '待生产',
        production: '生产中',
        shipping: '运输中',
        arrived: '已到货',
    },
    summary: {
        totalProducts: '有需求商品',
        totalDemand: '总需求量',
        shortageCount: '缺货商品',
    },
    orderCount: '{count} 个订单',
    table: {
        name: '商品名称',
        sku: 'SKU',
        brand: '品牌',
        category: '分类',
        stock: '当前库存',
        totalDemand: '总需求',
        shortage: '缺口',
        status: '状态',
    },
    status: {
        shortage: '缺货',
        warning: '预警',
        sufficient: '充足',
    },
    filter: {
        allBrands: '全部品牌',
        allCategories: '全部分类',
        shortageOnly: '仅显示缺货',
    },
    sort: {
        shortage: '按缺口排序',
        demand: '按需求量排序',
        name: '按名称排序',
    },
    export: '导出 CSV',
    empty: '暂无需要订货的商品',
};
