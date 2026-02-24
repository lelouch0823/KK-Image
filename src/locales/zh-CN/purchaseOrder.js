// 采购单 翻译 (Purchase Orders)
export default {
  title: '采购管理',
  subtitle: '管理境外采购单，跟踪运费/关税分摊与订单联动',

  // 采购单状态 (管理端视角)
  status: {
    draft: '草稿',
    ordered: '已向海外下单',
    shipping: '国际物流在途',
    arrived: '已入库待结算',
    completed: '已结算',
    cancelled: '已取消',
  },

  // 客户端视角 (双视角文案)
  customerView: {
    production: '海外备货中',
    shipping: '发往国内途中',
    arrived: '已到达仓库',
  },

  // 表格列
  table: {
    poNo: '采购单号',
    status: '状态',
    itemCount: '商品数',
    totalGoodsCost: '商品总额',
    estimatedShipping: '预估运费',
    estimatedTariff: '预估关税',
    actualShipping: '实际运费',
    actualTariff: '实际关税',
    createdAt: '创建时间',
    completedAt: '结算时间',
    product: '商品',
    quantity: '数量',
    unitCost: '单价',
  },

  // 详情
  detail: {
    title: '采购单详情',
    basicInfo: '基本信息',
    costInfo: '费用信息',
    items: '采购明细',
    linkedOrder: '关联订单',
    publicStock: '补公共库存',
    orderLocked: '与预定单关联的商品请通过管理关联订单来变更',
  },

  // 表单
  form: {
    remark: '备注',
    remarkPlaceholder: '可填写供应商、物流公司等信息',
    currency: '结算币种',
    allocationMethod: '分摊方式',
    byQuantity: '按件数平均',
    byValue: '按金额比例',
    estimatedShipping: '预估运费',
    estimatedTariff: '预估关税',
    actualShipping: '实际运费 (结算时填写)',
    actualTariff: '实际关税 (结算时填写)',
    unitCost: '单件入货成本',
    quantity: '数量',
    itemList: '采购商品',
    linkOrders: '关联预定单',
    addProducts: '增加商品',
    noItems: '暂未添加采购商品，请通过上方按钮引入',
    source: '来源',
    sourceOrder: '预定单',
    sourceStock: '补货',
    quantityWarning: '低于需求',
    confirmShortageTitle: '数量低于预定需求',
    confirmShortage: '以下商品的采购数量低于客户预定需求，确定继续创建吗？',
    confirmCreate: '确认创建',
    itemsCount: '件商品',
    totalQty: '总数量',
  },

  // 操作
  action: {
    create: '新建采购单',
    createFromOrders: '从订单生成采购单',
    addItem: '添加商品',
    addProduct: '添加商品',
    linkOrders: '关联预定单',
    removeItem: '移除',
    updateStatus: '变更状态',
    allocate: '执行成本分摊',
    viewSuggestions: '查看智能建议',
    settle: '填写实际费用',
  },

  // 提示
  toast: {
    created: '采购单已创建',
    createdFromOrders: '已从客户订单生成采购单',
    updated: '采购单已更新',
    itemUpdated: '明细已更新',
    statusUpdated: '状态已更新',
    itemsAdded: '商品已添加',
    itemRemoved: '商品已移除',
    allocated: '成本分摊完成',
  },

  // 错误
  error: {
    loadFailed: '加载采购单列表失败',
    notFound: '采购单不存在',
  },

  // 智能建议
  suggestions: {
    title: '智能采购建议',
    subtitle: '基于订货总览缺口，推荐优先采购的商品',
    shortage: '缺口',
    demand: '总需求',
    stock: '库存',
    orders: '关联订单',
    addAll: '全部加入采购单',
    addSelected: '将选中项加入采购单',
    empty: '暂无符合采购条件的商品',
  },

  // 分页
  pagination: {
    total: '共 {count} 条',
    prev: '上一页',
    next: '下一页',
  },

  // 空状态
  empty: '暂无采购单',
  emptyItems: '暂无明细',

  // 分摊结果
  allocation: {
    freight: '运费分摊',
    tariff: '关税分摊',
    landedCost: '综合到岸成本',
    perUnit: '/件',
  },

  // 筛选
  filter: {
    all: '全部',
    active: '进行中',
  },

  // 选择弹窗
  selection: {
    orderTitle: '选择预定单',
    orderSubtitle: '选择需要关联的客户预定单 (已确认状态)',
    searchOrder: '搜索预定单号、商品或客户名称...',
    productTitle: '选择商品',
    productSubtitle: '手动添加商品作为补货采购',
    searchProduct: '搜索商品名称或 SKU...',
    selectedCount: '已选 {count} 项',
    selectAll: '全选',
    deselectAll: '取消全选',
    emptyOrders: '暂无已确认的客户预定单',
    recommendedBrand: '同品牌推荐',
  },
};
