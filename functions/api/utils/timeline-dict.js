/**
 * 订单时间轴双语字典
 * 用于后端返回中英文对照的字段名和状态值
 * @module utils/timeline-dict
 */

/**
 * 字段名映射
 */
export const FIELD_LABELS = {
  // 基本信息
  name: { zh: '商品名称', en: 'Product Name' },
  brand: { zh: '品牌', en: 'Brand' },
  series: { zh: '系列', en: 'Series' },
  size: { zh: '规格尺寸', en: 'Size' },
  color: { zh: '颜色', en: 'Color' },
  material: { zh: '材质', en: 'Material' },
  remark: { zh: '备注', en: 'Remark' },
  deadline: { zh: '期望到货', en: 'Expected Arrival' },
  sku: { zh: 'SKU', en: 'SKU' },

  // 系统字段
  status: { zh: '状态', en: 'Status' },
  delivery_status: { zh: '物流状态', en: 'Delivery Status' },
  'order.detail.status': { zh: '状态', en: 'Status' }, // 兼容旧数据
  images: { zh: '图片', en: 'Images' },
  files: { zh: '图片', en: 'Images' },
};

/**
 * 状态值映射
 */
export const STATUS_VALUES = {
  pending: { zh: '待确认', en: 'Pending' },
  confirmed: { zh: '已确认', en: 'Confirmed' },
  production: { zh: '生产中', en: 'In Production' },
  warehouse: { zh: '已入库', en: 'In Warehouse' },
  fulfilled: { zh: '履约完成', en: 'Fulfillment Complete' },
  in_transit: { zh: '运输中', en: 'In Transit' },
  delivered: { zh: '已签收', en: 'Delivered' },
  returned: { zh: '已退回', en: 'Returned' },
  completed: { zh: '已完成', en: 'Completed' },
  cancelled: { zh: '已取消', en: 'Cancelled' },
  rejected: { zh: '已驳回', en: 'Rejected' },
  void: { zh: '已作废', en: 'Voided' },
};

/**
 * 获取字段及其值的双语显示对象
 * @param {string} fieldName - 字段名
 * @param {string} oldValue - 旧值
 * @param {string} newValue - 新值
 * @returns {Object} 双语显示对象 { field: {zh, en}, oldValue: {zh, en}, newValue: {zh, en} }
 */
export function getTimelineDisplay(fieldName, oldValue, newValue) {
  const display = {
    field: FIELD_LABELS[fieldName] || { zh: fieldName, en: fieldName },
    oldValue: { zh: oldValue, en: oldValue }, // 默认使用原始值
    newValue: { zh: newValue, en: newValue }, // 默认使用原始值
  };

  // 如果是状态字段，尝试翻译值
  if (['status', 'delivery_status', 'order.detail.status'].includes(fieldName)) {
    if (STATUS_VALUES[oldValue]) {
      display.oldValue = STATUS_VALUES[oldValue];
    }
    if (STATUS_VALUES[newValue]) {
      display.newValue = STATUS_VALUES[newValue];
    }
  }

  // 如果是图片数量 (简单处理：假设值包含数字)
  if (['images', 'files'].includes(fieldName)) {
    const formatImageCount = (val) => {
      const match = String(val).match(/(\d+)/);
      const count = match ? match[1] : '0';
      return { zh: `${count} 张图片`, en: `${count} Images` };
    };
    if (oldValue) display.oldValue = formatImageCount(oldValue);
    if (newValue) display.newValue = formatImageCount(newValue);
  }

  return display;
}
