// 库存预警看板 翻译 (Inventory Dashboard)
export default {
  title: '库存预警看板',
  subtitle: '实时监控库存水平，及时发现低库存与零库存风险',

  // 摘要卡片
  summary: {
    totalSkus: '活跃 SKU',
    lowStock: '低库存',
    zeroStock: '零库存',
    inventoryValue: '库存价值',
  },

  // 低库存表格
  lowStock: {
    title: '低库存预警',
    empty: '暂无低库存商品',
    table: {
      product: '商品名称',
      sku: 'SKU',
      variant: '规格',
      available: '可用库存',
      onHand: '在手库存',
      reserved: '已预留',
      threshold: '预警阈值',
    },
  },

  // 零库存表格
  zeroStock: {
    title: '零库存商品',
    empty: '暂无零库存商品',
    table: {
      product: '商品名称',
      sku: 'SKU',
      variant: '规格',
      onHand: '在手库存',
      reserved: '已预留',
    },
  },

  // 最近变动
  movements: {
    title: '最近库存变动',
    empty: '暂无库存变动记录',
    table: {
      product: '商品名称',
      sku: 'SKU',
      type: '变动类型',
      delta: '变动数量',
      time: '时间',
    },
    eventType: {
      purchase_ordered: '采购下单',
      purchase_received: '采购收货',
      purchase_arrival: '采购到货',
      inventory_allocated_to_order_line: '分配至订单',
      inventory_deallocated_from_order_line: '从订单释放',
      inventory_reserved: '库存预留',
      reservation_hold: '预留锁定',
      inventory_released: '库存释放',
      reservation_release: '预留解锁',
      order_shipment: '订单出库',
      order_unshipment: '出库撤回',
      order_return_restock: '退货入库',
      order_line_cancelled: '订单行取消',
      inventory_adjusted_reversal: '调整冲正',
      manual_adjustment: '手动调整',
    },
  },

  // 出库排行
  topMoving: {
    title: '近 30 天出库排行',
    empty: '暂无出库数据',
    table: {
      product: '商品名称',
      sku: 'SKU',
      variant: '规格',
      outbound: '出库量',
    },
  },

  // 权限
  permissionDenied: '库存看板权限不足',
  permissionDeniedDesc: '当前账号没有库存看板读取权限，请联系管理员分配 products:manage。',
};
