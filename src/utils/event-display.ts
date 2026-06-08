type DisplayRow = {
  label: string;
  value: string;
};

const DOMAIN_EVENT_LABELS: Record<string, string> = {
  admin_notification_created: '管理员通知已创建',
  file_uploaded: '文件已上传',
  inventory_received: '库存已入库',
  inventory_receipt_reversed: '库存收货已冲销',
  order_comment_created_by_admin: '管理员新增订单留言',
  order_created_by_admin: '管理员创建订单',
  order_deadline_reminder_due: '订单交期提醒',
  order_deleted_by_admin: '管理员删除订单',
  order_delivery_confirmed: '订单交付已确认',
  order_pending_reminder_due: '待处理订单提醒',
  order_procurement_progressed: '预定单采购进度已推进',
  order_procurement_reversed: '预定单采购进度已回退',
  order_read_by_admin: '管理员查看订单',
  order_status_changed_by_admin: '管理员变更订单状态',
  purchase_order_cost_allocated: '采购成本已分摊',
  purchase_order_created: '采购单已创建',
  purchase_order_created_from_orders: '采购单已由订单创建',
  purchase_order_item_created: '采购单明细已新增',
  purchase_order_item_deleted: '采购单明细已删除',
  purchase_order_item_updated: '采购单明细已更新',
  purchase_order_status_changed: '采购单状态已变更',
  purchase_order_updated: '采购单已更新',
  purchase_receipt_recorded: '采购收货已登记',
  purchase_receipt_reversed: '采购收货已冲销',
  salesperson_created: '销售已创建',
  salesperson_deleted: '销售已删除',
  salesperson_token_reset: '销售访问令牌已重置',
  salesperson_updated: '销售已更新',
  space_created: '空间已创建',
  space_deleted: '空间已删除',
  space_file_reordered: '空间文件顺序已调整',
  space_subspace_created: '子空间已创建',
  space_updated: '空间已更新',
  tag_assigned_to_file: '文件标签已添加',
  tag_created: '标签已创建',
  tag_unassigned_from_file: '文件标签已移除',
  v1_file_updated: '文件已更新',
  v1_folder_updated: '文件夹已更新',
  'webhook.test': 'Webhook 测试事件',
};

const CONSUMER_LABELS: Record<string, string> = {
  audit: '审计',
  cache: '缓存',
  notification: '通知',
  webhook: 'Webhook',
};

const CONSUMER_STATUS_LABELS: Record<string, string> = {
  failed: '失败',
  pending: '待处理',
  processing: '处理中',
  published: '已完成',
  skipped: '已跳过',
};

const BACKUP_ENVIRONMENT_LABELS: Record<string, string> = {
  development: '开发环境',
  dev: '开发环境',
  local: '本地环境',
  preview: '预览环境',
  production: '生产环境',
  prod: '生产环境',
  staging: '预发布环境',
  test: '测试环境',
};

const BACKUP_RESTORE_MODE_LABELS: Record<string, string> = {
  dry_run: '试运行恢复',
  dryRun: '试运行恢复',
  restore: '正式恢复',
  execute: '正式恢复',
  validate: '恢复校验',
};

const BACKUP_RESTORE_STATUS_LABELS: Record<string, string> = {
  blocked: '已阻止',
  completed: '已完成',
  failed: '失败',
  success: '成功',
};

function isBlank(value: unknown): boolean {
  return value === null || value === undefined || value === '';
}

function compactRows(rows: Array<DisplayRow | null>): DisplayRow[] {
  return rows.filter((row): row is DisplayRow => Boolean(row && !isBlank(row.value)));
}

function firstPresent(...values: unknown[]): unknown {
  return values.find((value) => !isBlank(value));
}

function formatCount(value: unknown, unit = ''): string {
  if (isBlank(value)) return '-';
  return `${value}${unit ? ` ${unit}` : ''}`;
}

function toPascalToken(token: string): string {
  if (!token) return '';
  return token.charAt(0).toUpperCase() + token.slice(1).toLowerCase();
}

const READABLE_TOKEN_LABELS: Record<string, string> = {
  ai: 'AI',
  api: 'API',
  erp: 'ERP',
  id: 'ID',
  oauth: 'OAuth',
  po: 'PO',
  rest: 'REST',
  sku: 'SKU',
  spu: 'SPU',
  ui: 'UI',
  url: 'URL',
  vip: 'VIP',
};

function toReadableToken(token: string): string {
  if (!token) return '';
  const normalized = token.toLowerCase();
  return READABLE_TOKEN_LABELS[normalized] || toPascalToken(token);
}

export function formatReadableLabel(value: unknown, suffix = ''): string {
  const raw = String(value || '').trim();
  if (!raw) return '-';
  const label = raw
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
    .split(/[-_.\s]+/)
    .filter(Boolean)
    .map(toReadableToken)
    .join(' ');
  return `${label || raw}${suffix}`;
}

export function formatReadableCode(value: unknown, suffix = ''): string {
  const raw = String(value || '').trim();
  if (!raw) return '-';
  const label = raw
    .split(/[-_.\s]+/)
    .filter(Boolean)
    .map(toPascalToken)
    .join('');
  return `${label || raw}${suffix}`;
}

export function formatSummaryValue(value: unknown): string {
  if (isBlank(value)) return '-';
  if (Array.isArray(value)) {
    if (value.length === 0) return '-';
    const hasStructuredItems = value.some((item) => item && typeof item === 'object');
    return hasStructuredItems ? `${value.length} 项` : value.map((item) => formatSummaryValue(item)).join(', ');
  }
  if (typeof value === 'object') {
    return `已填写 ${Object.keys(value as Record<string, unknown>).length} 项`;
  }
  return String(value);
}

export function formatDomainEventType(eventType: unknown): string {
  const raw = String(eventType || '').trim();
  if (!raw) return '-';
  return DOMAIN_EVENT_LABELS[raw] || formatReadableCode(raw.replace(/[-_.]?event$/i, ''), '事件');
}

export function formatConsumerName(consumerName: unknown): string {
  const raw = String(consumerName || '').trim();
  if (!raw) return '-';
  return CONSUMER_LABELS[raw] || formatReadableCode(raw);
}

export function formatConsumerStatus(status: unknown): string {
  const raw = String(status || '').trim();
  if (!raw) return '-';
  return CONSUMER_STATUS_LABELS[raw] || formatReadableCode(raw);
}

export function formatConsumerJobLabel(job: Record<string, unknown> = {}): string {
  return `${formatConsumerName(job.consumer_name)} · ${formatConsumerStatus(job.status)}`;
}

export function formatBackupRestoreEnvironment(environment: unknown): string {
  const raw = String(environment || '').trim();
  if (!raw) return '未知环境';
  return BACKUP_ENVIRONMENT_LABELS[raw] || formatReadableCode(raw, '环境');
}

export function formatBackupRestoreMode(mode: unknown): string {
  const raw = String(mode || '').trim();
  if (!raw) return '-';
  return BACKUP_RESTORE_MODE_LABELS[raw] || formatReadableCode(raw, '模式');
}

export function formatBackupRestoreStatus(status: unknown): string {
  const raw = String(status || '').trim();
  if (!raw) return '-';
  return BACKUP_RESTORE_STATUS_LABELS[raw] || formatReadableCode(raw);
}

export function buildReplayResultSummaryRows(result: Record<string, unknown> | null = null): DisplayRow[] {
  if (!result) return [];

  const isDryRun = Boolean(result.dryRun || result.dry_run);
  const failed = result.status === 'failed' || Boolean(result.error);
  const consumerName = firstPresent(result.consumerName, result.consumer_name);
  const matchedJobs = firstPresent(result.matchedJobs, result.matched_jobs);
  const affectedEvents = firstPresent(result.affectedEvents, result.affected_events);
  const runId = firstPresent(result.runId, result.run_id);

  return compactRows([
    {
      label: '操作模式',
      value: isDryRun ? 'Dry Run（只检查不执行）' : '正式 Replay',
    },
    consumerName
      ? {
          label: '目标消费者',
          value: formatConsumerName(consumerName),
        }
      : null,
    !isBlank(matchedJobs)
      ? {
          label: '命中消费者',
          value: formatCount(matchedJobs, '个'),
        }
      : null,
    !isBlank(affectedEvents)
      ? {
          label: '命中事件',
          value: Array.isArray(affectedEvents)
            ? formatCount(affectedEvents.length, '条')
            : formatCount(affectedEvents, '条'),
        }
      : null,
    result.status
      ? {
          label: '执行状态',
          value: failed ? '失败' : formatBackupRestoreStatus(result.status),
        }
      : null,
    result.error ? { label: '错误信息', value: String(result.error) } : null,
    runId ? { label: '运行 ID', value: String(runId) } : null,
  ]);
}

export function buildBackupRestoreSummaryRows(result: Record<string, unknown> | null = null): DisplayRow[] {
  if (!result) return [];

  const checkedTables = firstPresent(result.checkedTables, result.checked_tables);
  const restoredRows = firstPresent(result.restoredRows, result.restored_rows);

  return compactRows([
    {
      label: '运行环境',
      value: formatBackupRestoreEnvironment(result.environment),
    },
    {
      label: '恢复模式',
      value: formatBackupRestoreMode(result.mode),
    },
    result.allowed !== undefined
      ? {
          label: '执行许可',
          value: result.allowed === false ? '不允许执行' : '允许执行',
        }
      : null,
    result.executed !== undefined
      ? {
          label: '是否已执行',
          value: result.executed ? '已执行' : '未执行',
        }
      : null,
    !isBlank(checkedTables)
      ? {
          label: '检查数据表',
          value: formatCount(checkedTables, '张'),
        }
      : null,
    !isBlank(restoredRows)
      ? {
          label: '恢复数据行',
          value: formatCount(restoredRows, '行'),
        }
      : null,
    result.status
      ? {
          label: '恢复状态',
          value: formatBackupRestoreStatus(result.status),
        }
      : null,
    result.error ? { label: '错误信息', value: String(result.error) } : null,
  ]);
}
