import { safeParseJson } from '@/utils/json.js';

/** 审计日志行数据结构 */
export interface AuditRow {
  summary?: string;
  actor_name?: string;
  actor_id?: string;
  user_id?: string;
  action?: string;
  target_label?: string;
  target_id?: string;
  target_type?: string;
  changes_json?: string | Record<string, unknown>;
  metadata_json?: string | Record<string, unknown>;
  payload?: string | Record<string, unknown>;
  result?: string;
  severity?: string;
  [key: string]: unknown;
}

/** 归一化后的审计日志行 */
export interface NormalizedAuditRow extends AuditRow {
  actor_display: string;
  action_display: string;
  target_display: string;
  summary_display: string;
  details_display: string;
  changes_display: Record<string, unknown> | null;
  metadata_display: Record<string, unknown> | null;
  result: string;
  severity: string;
}

const AUDIT_ACTION_LABELS: Record<string, string> = {
  'admin.auth.login': '管理员登录',
  'admin.auth.logout': '管理员退出登录',
  'admin.auth.token': '管理员令牌登录',
  'sales.auth.login': '销售端登录',
  'sales.auth.wechat_login': '销售端微信登录',
  'sales.auth.token_login': '销售端令牌登录',
  'sales.auth.locked': '销售端登录被锁定',
  'sales.auth.failed': '销售端登录失败',
  'sales.profile.bind_wechat': '绑定销售微信',
  'sales.notification.read': '销售端读取通知',
  'sales.order.create': '销售端创建订单',
  'sales.order.read': '销售端查看订单',
  'sales.order.update': '销售端更新订单',
  'sales.order.void': '销售端作废订单',
  'sales.order.comment.create': '销售端新增订单留言',
  'sales.file.upload': '销售端上传文件',
  'order.create': '创建订单',
  'order.update': '更新订单',
  'order.replace': '替换订单',
  'order.batch_update': '批量更新订单',
  'order.status.change': '变更订单状态',
  'order.status.force_change': '强制变更订单状态',
  'order.delivery.confirm': '确认订单交付',
  'order.comment.create': '新增订单留言',
  'order.archive': '归档订单',
  'order.restore': '恢复订单',
  'order.delete': '删除订单',
  'order.logistics.update': '更新订单物流',
  'order.line.reserve': '预留订单明细',
  'order.line.release': '释放订单明细预留',
  'order.line.ship': '发货订单明细',
  'order.line.unship': '撤销订单明细发货',
  'order.line.return': '退回订单明细',
  'purchase_order.create': '创建采购单',
  'purchase_order.create_from_orders': '由订单创建采购单',
  'purchase_order.update': '更新采购单',
  'purchase_order.status.change': '变更采购单状态',
  'purchase_order.receipt.create': '登记采购收货',
  'purchase_order.receipt.reverse': '冲销采购收货',
  'purchase_order.shortage.close': '关闭采购缺口',
  'purchase_order.item.create': '新增采购单明细',
  'purchase_order.item.update': '更新采购单明细',
  'purchase_order.item.delete': '删除采购单明细',
  'purchase_order.allocate': '分配采购库存',
  'product.create': '创建商品',
  'product.update': '更新商品',
  'product.replace': '替换商品',
  'product.archive': '归档商品',
  'product.status.update': '更新商品状态',
  'product.batch_import': '批量导入商品',
  'product.batch_status': '批量更新商品状态',
  'product.dimension.create': '新增商品规格维度',
  'product.dimension.update': '更新商品规格维度',
  'product.dimension.archive': '归档商品规格维度',
  'product.dimension_value.create': '新增商品规格值',
  'product.dimension_value.archive': '归档商品规格值',
  'product.dimension_value.restore': '恢复商品规格值',
  'product.variant_image.create': '新增商品变体图片',
  'product.variant_image.sort': '排序商品变体图片',
  'product.variant_image.primary': '设置商品主图',
  'product.variant_image.delete': '删除商品变体图片',
  'product.price_rules.upsert': '保存商品价格规则',
  'product.price_rules.delete': '删除商品价格规则',
  'inventory_stock.adjust': '调整库存数量',
  variant_updated: '更新商品变体',
  variant_archived: '归档商品变体',
  'customer.create': '创建客户',
  'customer.update': '更新客户',
  'customer.delete': '删除客户',
  'customer.import': '导入客户',
  'customer.batch_add_tag': '批量添加客户标签',
  'customer.batch_export': '批量导出客户',
  'customer.add_communication': '新增客户沟通记录',
  'customer.delete_communication': '删除客户沟通记录',
  'customer.add_tag': '添加客户标签',
  'customer.remove_tag': '移除客户标签',
  'file.create': '上传文件',
  'file.update': '更新文件',
  'file.delete': '删除文件',
  'file.batch_delete': '批量删除文件',
  'file.batch_move': '批量移动文件',
  'upload.create': '上传文件',
  'folder.create': '创建文件夹',
  'folder.update': '更新文件夹',
  'folder.delete': '删除文件夹',
  'folder.share_update': '更新文件夹分享',
  'folder.upload': '上传到文件夹',
  'space.create': '创建空间',
  'space.update': '更新空间',
  'space.delete': '删除空间',
  'space.file.add': '添加空间文件',
  'space.file.remove': '移除空间文件',
  'space.file.reorder': '调整空间文件排序',
  'space.subspace.create': '创建子空间',
  'salesperson.create': '创建销售',
  'salesperson.update': '更新销售',
  'salesperson.delete': '删除销售',
  'salesperson.reset_token': '重置销售访问令牌',
  'notification.create': '创建通知',
  'notification.read': '读取通知',
  'tag.create': '创建标签',
  'tag.assign': '分配标签',
  'tag.unassign': '取消分配标签',
  'album.create': '创建相册',
  'album.update': '更新相册',
  'album.delete': '删除相册',
  'album.file.add': '添加相册文件',
  'album.file.remove': '移除相册文件',
  'webhook.create': '创建 Webhook',
  'webhook.update': '更新 Webhook',
  'webhook.delete': '删除 Webhook',
  'webhook.test': '测试 Webhook',
  'webhook.retry': '重试 Webhook',
  'backup.create': '创建备份',
  'backup.restore.validate': '校验备份恢复',
  'backup.restore.dry_run': '试运行备份恢复',
  'backup.restore.execute': '执行备份恢复',
  'backup.delete': '删除备份',
  'trash.restore': '从回收站恢复',
  'trash.delete': '删除回收站项目',
  'trash.empty': '清空回收站',
  'settings.batch_upsert': '批量保存设置',
  'settings.update': '更新设置',
  'audit.read': '读取操作审计',
  'audit.actions.read': '读取审计动作列表',
  'audit.export': '导出操作审计',
  'outbox.replay.dry_run': '试运行 Outbox 重放',
  'outbox.replay.execute': '执行 Outbox 重放',
  'user.create': '创建用户',
  'user.update': '更新用户',
  'user.delete': '删除用户',
};

const AUDIT_TARGET_LABELS: Record<string, string> = {
  album: '相册',
  audit_log: '审计日志',
  backup: '备份',
  customer: '客户',
  file: '文件',
  folder: '文件夹',
  notification: '通知',
  order: '订单',
  order_line: '订单明细',
  outbox_event: 'Outbox 事件',
  product: '商品',
  product_variant: '商品变体',
  purchase_order: '采购单',
  purchase_order_item: '采购单明细',
  salesperson: '销售',
  setting: '系统设置',
  space: '空间',
  system: '系统',
  tag: '标签',
  trash: '回收站项目',
  user: '用户',
  webhook: 'Webhook',
};

const DETAIL_FIELD_LABELS: Record<string, string> = {
  action: '动作',
  actorId: '操作者ID',
  actorName: '操作者',
  after: '变更后',
  before: '变更前',
  changeCount: '变更数量',
  commandId: '命令ID',
  count: '数量',
  created: '创建数量',
  deleted: '删除数量',
  domain: '领域',
  error: '错误',
  eventId: '事件ID',
  failed: '失败数量',
  fileId: '文件ID',
  fileName: '文件名',
  folderId: '文件夹ID',
  id: 'ID',
  ids: 'ID列表',
  itemId: '明细ID',
  lineId: '订单明细ID',
  message: '消息',
  name: '名称',
  note: '备注',
  orderId: '订单ID',
  orderIds: '订单ID列表',
  orderNumber: '采购单号',
  productId: '商品ID',
  quantity: '数量',
  reason: '原因',
  requestId: '请求ID',
  result: '结果',
  runId: '运行ID',
  sku: 'SKU',
  status: '状态',
  summary: '摘要',
  targetId: '目标ID',
  targetType: '目标类型',
  traceId: '链路ID',
  updated: '更新数量',
  userId: '用户ID',
  value: '值',
  variantId: '变体ID',
};

const SIMPLE_ACTION_VERBS: Record<string, string> = {
  add: '添加',
  allocate: '分配',
  archive: '归档',
  assign: '分配',
  batch: '批量处理',
  bind: '绑定',
  change: '变更',
  close: '关闭',
  confirm: '确认',
  create: '创建',
  delete: '删除',
  dry_run: '试运行',
  empty: '清空',
  execute: '执行',
  export: '导出',
  failed: '失败',
  force_change: '强制变更',
  import: '导入',
  login: '登录',
  logout: '退出登录',
  move: '移动',
  primary: '设为主图',
  read: '读取',
  release: '释放',
  remove: '移除',
  reorder: '调整排序',
  replace: '替换',
  reserve: '预留',
  reset: '重置',
  restore: '恢复',
  return: '退回',
  reverse: '冲销',
  retry: '重试',
  ship: '发货',
  sort: '排序',
  test: '测试',
  token: '令牌登录',
  unassign: '取消分配',
  unauthorized: '未登录访问',
  unship: '撤销发货',
  update: '更新',
  upload: '上传',
  upsert: '保存',
  validate: '校验',
  void: '作废',
};

export function parseAuditJson(value: unknown, fallback: Record<string, unknown> | null = null): Record<string, unknown> | null {
  if (!value) return fallback;
  if (typeof value === 'object' && value !== null) return value as Record<string, unknown>;
  return safeParseJson(value, fallback) as Record<string, unknown> | null;
}

function toReadableCode(value: unknown): string {
  const text = String(value || '').trim();
  if (!text) return '-';
  return text
    .replace(/[-_.]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^./, (first) => first.toUpperCase());
}

function formatDetailKey(key: string): string {
  return DETAIL_FIELD_LABELS[key] || toReadableCode(key);
}

function formatDetailValue(value: unknown): string {
  if (value === null || value === undefined || value === '') return '-';
  if (Array.isArray(value)) {
    return value.length > 0 ? value.map((item) => formatDetailValue(item)).join('、') : '[]';
  }
  if (typeof value === 'object') {
    return JSON.stringify(value);
  }
  return String(value);
}

export function formatAuditAction(action: unknown): string {
  const rawAction = String(action || '').trim();
  if (!rawAction) return '-';
  if (AUDIT_ACTION_LABELS[rawAction]) return AUDIT_ACTION_LABELS[rawAction];

  const parts = rawAction.split('.');
  const verb = parts[parts.length - 1] || rawAction;
  const subjectParts = parts.slice(0, -1);
  const subject = subjectParts.length > 0 ? subjectParts.join('_') : '';
  const subjectLabel = AUDIT_TARGET_LABELS[subject] || toReadableCode(subject);
  const verbLabel = SIMPLE_ACTION_VERBS[verb] || toReadableCode(verb);

  if (!subject || subjectLabel === '-') return verbLabel;
  if (!SIMPLE_ACTION_VERBS[verb]) return `${subjectLabel} ${toReadableCode(verb).toLowerCase()}`;
  return `${verbLabel}${subjectLabel}`;
}

export function formatAuditTarget(row: AuditRow = {}): string {
  const targetType = String(row.target_type || '').trim();
  const targetTypeLabel = targetType ? AUDIT_TARGET_LABELS[targetType] || toReadableCode(targetType) : '目标对象';
  const targetIdentifier = row.target_label || row.target_id;
  return targetIdentifier ? `${targetTypeLabel} / ${targetIdentifier}` : targetTypeLabel;
}

export function formatAuditSummary(row: AuditRow = {}): string {
  if (row.summary) return row.summary;
  const actor = row.actor_name || row.actor_id || row.user_id || 'Unknown';
  const action = formatAuditAction(row.action);
  const target = formatAuditTarget(row);
  return `${actor} ${action} ${target}`;
}

export function normalizeAuditRow(row: AuditRow = {}): NormalizedAuditRow {
  const changes = parseAuditJson(row.changes_json, null);
  const metadata = parseAuditJson(row.metadata_json, parseAuditJson(row.payload, null));
  return {
    ...row,
    actor_display: row.actor_name || row.actor_id || row.user_id || '-',
    action_display: formatAuditAction(row.action),
    target_display: formatAuditTarget(row),
    summary_display: formatAuditSummary(row),
    details_display: formatAuditDetails({ ...row, changes_json: changes, metadata_json: metadata }),
    changes_display: changes,
    metadata_display: metadata,
    result: row.result || 'success',
    severity: row.severity || 'normal',
  };
}

export function formatAuditDetails(row: AuditRow = {}): string {
  const changes = parseAuditJson(row.changes_json, null);
  const metadata = parseAuditJson(row.metadata_json, parseAuditJson(row.payload, null));
  const details = changes || metadata;
  if (details) {
    const entries = Object.entries(details)
      .filter(([, value]) => value !== undefined)
      .map(([key, value]) => `${formatDetailKey(key)}：${formatDetailValue(value)}`);
    return entries.length > 0 ? entries.join('；') : '-';
  }
  return '-';
}
