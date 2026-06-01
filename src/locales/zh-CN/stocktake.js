// 库存盘点 翻译 (Stocktake)
export default {
  title: '库存盘点',
  subtitle: '创建盘点任务，记录实际库存，调整系统库存',

  // 盘点单状态
  status: {
    draft: '草稿',
    counting: '盘点中',
    adjusted: '已调整',
    cancelled: '已取消',
  },

  // 摘要
  summary: {
    total: '盘点单总数',
    counting: '进行中',
    adjusted: '已完成',
    diffItems: '差异项',
  },

  // 表格列
  table: {
    id: '盘点单号',
    status: '状态',
    itemCount: '商品数',
    countedItems: '已盘数',
    diffItems: '差异项',
    createdAt: '创建时间',
    completedAt: '完成时间',
    notes: '备注',
  },

  // 明细表格
  detail: {
    title: '盘点明细',
    product: '商品名称',
    sku: 'SKU',
    variant: '规格',
    systemQty: '系统数量',
    actualQty: '实际数量',
    difference: '差异',
    notes: '备注',
    noItems: '暂无盘点明细',
    counted: '已盘点',
    total: '共 {count} 项',
  },

  // 操作
  action: {
    create: '新建盘点',
    save: '保存',
    adjust: '调整库存',
    cancel: '取消盘点',
    print: '打印报告',
    back: '返回列表',
    confirmAdjust: '确认调整',
    confirmCancel: '确认取消',
  },

  // 确认对话框
  confirm: {
    adjustTitle: '确认调整库存',
    adjustMessage: '将根据盘点差异自动调整系统库存，此操作不可撤销。确定继续吗？',
    cancelTitle: '取消盘点',
    cancelMessage: '确定取消此盘点单吗？取消后不可恢复。',
  },

  // 提示
  toast: {
    created: '盘点单已创建',
    updated: '盘点明细已保存',
    adjusted: '库存调整完成',
    cancelled: '盘点单已取消',
    adjustFailed: '库存调整失败',
    noDifference: '没有差异项需要调整',
  },

  // 表单
  form: {
    notes: '备注',
    notesPlaceholder: '可填写盘点说明',
    actualQtyPlaceholder: '输入实际数量',
  },

  // 分页
  pagination: {
    total: '共 {count} 条',
    prev: '上一页',
    next: '下一页',
  },

  // 空状态
  empty: '暂无盘点单',
  emptyHint: '点击"新建盘点"开始库存盘点',

  // 筛选
  filter: {
    all: '全部',
    draft: '草稿',
    counting: '盘点中',
    adjusted: '已完成',
    cancelled: '已取消',
  },
};
