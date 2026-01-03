/**
 * 管理端订单导出 API
 * GET /api/manage/orders/export - 导出订单为 CSV
 */

import { error } from '../../utils/response.js';
import { MSG } from '../../utils/messages.js';
import { ORDER_STATUSES } from '../../../_shared/utils.js';

// CSV 导出字段定义
const EXPORT_COLUMNS = [
  { key: 'orderNo', label: '订单编号' },
  { key: 'productName', label: '商品名称' },
  { key: 'brand', label: '品牌' },
  { key: 'series', label: '系列' },
  { key: 'size', label: '规格尺寸' },
  { key: 'color', label: '颜色' },
  { key: 'material', label: '材质' },
  { key: 'status', label: '状态' },
  { key: 'salesperson', label: '销售员' },
  { key: 'store', label: '门店' },
  { key: 'remark', label: '备注' },
  { key: 'createdAt', label: '提交时间' },
  { key: 'updatedAt', label: '更新时间' },
];

// 状态名称映射
const STATUS_LABELS = {
  pending: '待确认',
  confirmed: '已确认',
  rejected: '已驳回',
  production: '生产中',
  shipping: '已发货',
  arrived: '已到店',
  delivered: '已交付',
  void: '已作废',
};

/**
 * 格式化日期为本地时间字符串
 */
function formatDate(timestamp) {
  if (!timestamp) return '';
  const date = new Date(timestamp);
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * 转义 CSV 字段值
 */
function escapeCSV(value) {
  if (value === null || value === undefined) return '';
  const str = String(value);
  // 如果包含逗号、引号或换行符，需要用引号包裹并转义内部引号
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * 生成 CSV 内容
 */
function generateCSV(orders) {
  // 表头
  const header = EXPORT_COLUMNS.map((col) => col.label).join(',');

  // 数据行
  const rows = orders.map((order) => {
    return EXPORT_COLUMNS.map((col) => {
      let value;
      switch (col.key) {
        case 'status':
          value = STATUS_LABELS[order.status] || order.status;
          break;
        case 'createdAt':
        case 'updatedAt':
          value = formatDate(order[col.key]);
          break;
        default:
          value = order[col.key];
      }
      return escapeCSV(value);
    }).join(',');
  });

  // 添加 BOM 以支持 Excel 正确识别 UTF-8
  return '\uFEFF' + [header, ...rows].join('\n');
}

/**
 * GET - 导出订单列表为 CSV
 */
import { authenticateAdmin } from '../../utils/auth.js';

/**
 * GET - 导出订单列表为 CSV
 */
export async function onRequestGet(context) {
  const { env, request } = context;

  try {
    await authenticateAdmin(request, env);
    const url = new URL(request.url);
    const salespersonId = url.searchParams.get('salesperson');
    const status = url.searchParams.get('status');
    const search = url.searchParams.get('search');
    const fromDate = url.searchParams.get('from');
    const toDate = url.searchParams.get('to');

    // 构建查询条件
    let whereClause = '1=1';
    const bindParams = [];

    if (salespersonId) {
      whereClause += ' AND o.salesperson_id = ?';
      bindParams.push(salespersonId);
    }

    if (status && ORDER_STATUSES.includes(status)) {
      whereClause += ' AND o.status = ?';
      bindParams.push(status);
    }

    if (search) {
      whereClause += ' AND (o.order_no LIKE ? OR o.current_data LIKE ?)';
      const searchPattern = `%${search}%`;
      bindParams.push(searchPattern, searchPattern);
    }

    if (fromDate) {
      whereClause += ' AND o.created_at >= ?';
      const { parseChinaDate } = await import('../../utils/date.js');
      bindParams.push(parseChinaDate(fromDate));
    }

    if (toDate) {
      whereClause += ' AND o.created_at <= ?';
      const { parseChinaDate } = await import('../../utils/date.js');
      // 加上一天的毫秒数以包含当天
      bindParams.push(parseChinaDate(toDate) + 86400000);
    }

    // 获取订单列表 (不分页，导出全部)
    const { results: orders } = await env.DB.prepare(
      `
            SELECT 
                o.id, o.order_no, o.current_data, o.status, 
                o.created_at, o.updated_at,
                s.name as salesperson_name, s.store as salesperson_store
            FROM orders o
            LEFT JOIN salespersons s ON o.salesperson_id = s.id
            WHERE ${whereClause}
            ORDER BY o.created_at DESC
            LIMIT 10000
        `
    )
      .bind(...bindParams)
      .all();

    // 格式化数据
    const formattedOrders = orders.map((order) => {
      const currentData = order.current_data ? JSON.parse(order.current_data) : {};
      return {
        orderNo: order.order_no,
        productName: currentData.name || '',
        brand: currentData.brand || '',
        series: currentData.series || '',
        size: currentData.size || '',
        color: currentData.color || '',
        material: currentData.material || '',
        status: order.status,
        salesperson: order.salesperson_name || '',
        store: order.salesperson_store || '',
        remark: currentData.remark || '',
        createdAt: order.created_at,
        updatedAt: order.updated_at,
      };
    });

    // 生成 CSV
    const csv = generateCSV(formattedOrders);
    const { getChinaDateStr } = await import('../../utils/date.js');
    const filename = `orders_${getChinaDateStr()}.csv`;

    return new Response(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-cache',
      },
    });
  } catch (err) {
    if (err.message === MSG.AUTH.REQUIRED || err.message === MSG.AUTH.EXPIRED) {
      return error(err.message, 401);
    }
    console.error('Order export error:', err);
    return error(`${MSG.COMMON.OP_FAILED}: ${err.message}`, 500);
  }
}
