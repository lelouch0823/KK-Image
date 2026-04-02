import {
  formatDateTime,
  pickFirstString,
  safeParseObject,
  toFiniteNumber,
} from '../../utils/helpers';

type UnknownRecord = Record<string, unknown>;

interface DetailInfoRow {
  label: string;
  value: string;
  multiline?: boolean;
}

interface StatusMeta {
  label: string;
  color: string;
  background: string;
}

export interface OrderDetailSummaryViewModel {
  orderNo: string;
  title: string;
  status: string;
  statusLabel: string;
  statusStyle: string;
  quantity: number;
  mainImage: string;
  infoRows: DetailInfoRow[];
}

interface OrderLineMetric {
  label: string;
  value: number;
}

export interface OrderDetailLineViewModel {
  id: string;
  title: string;
  status: string;
  statusLabel: string;
  statusStyle: string;
  orderedQty: number;
  procuredQty: number;
  receivedQty: number;
  reservedQty: number;
  shippedQty: number;
  cancelledQty: number;
  imageUrl: string;
  metrics: OrderLineMetric[];
}

export interface OrderDetailFileViewModel {
  id: string;
  name: string;
  url: string;
  mimeType: string;
  size: number;
  isImage: boolean;
  isVideo: boolean;
  typeLabel: string;
}

export interface OrderDetailTimelineViewModel {
  id: string;
  title: string;
  content: string;
  actorName: string;
  createdAt: number;
  timeText: string;
}

export interface OrderDetailViewModel {
  summary: OrderDetailSummaryViewModel;
  lines: OrderDetailLineViewModel[];
  files: OrderDetailFileViewModel[];
  timeline: OrderDetailTimelineViewModel[];
}

export interface DuplicatePrefillFile {
  id?: string;
  url: string;
  name: string;
  type: 'image' | 'video';
  status: 'done';
  isLocal: false;
}

export interface DuplicatePrefill {
  name: string;
  brand: string;
  series: string;
  sku: string;
  size: string;
  color: string;
  material: string;
  remark: string;
  deadline: string;
  quantity: number;
  productId?: string;
  variantId?: string;
  files: DuplicatePrefillFile[];
}

const STATUS_META: Record<string, StatusMeta> = {
  pending: { label: '待确认', color: '#b45309', background: '#fef3c7' },
  confirmed: { label: '已确认', color: '#1d4ed8', background: '#dbeafe' },
  rejected: { label: '已驳回', color: '#b91c1c', background: '#fee2e2' },
  production: { label: '生产中', color: '#6d28d9', background: '#ede9fe' },
  shipping: { label: '已发货', color: '#0e7490', background: '#cffafe' },
  arrived: { label: '已到店', color: '#047857', background: '#d1fae5' },
  delivered: { label: '已交付', color: '#15803d', background: '#dcfce7' },
  void: { label: '已作废', color: '#4b5563', background: '#e5e7eb' },
  partially_received: { label: '部分到货', color: '#92400e', background: '#fde68a' },
  received: { label: '已到货', color: '#047857', background: '#d1fae5' },
};

function asRecord(value: unknown): UnknownRecord {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as UnknownRecord;
  }
  return {};
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function pickRecordString(record: UnknownRecord, keys: string[], fallback = ''): string {
  return pickFirstString(keys.map((key) => record[key]), fallback);
}

function toPositiveNumber(value: unknown, fallback = 1): number {
  const next = toFiniteNumber(value, fallback);
  return next > 0 ? next : fallback;
}

function resolveMimeType(record: UnknownRecord): string {
  return pickRecordString(record, ['mimeType', 'mime_type']);
}

function resolveImageFlag(mimeType: string, url: string): boolean {
  if (mimeType.startsWith('image/')) {
    return true;
  }

  return /\.(png|jpe?g|gif|webp|bmp|svg)$/i.test(url);
}

function resolveVideoFlag(mimeType: string, url: string): boolean {
  if (mimeType.startsWith('video/')) {
    return true;
  }

  return /\.(mp4|mov|avi|m4v|webm)$/i.test(url);
}

function resolveStatusMeta(status: string): StatusMeta {
  return STATUS_META[status] || {
    label: status || '处理中',
    color: '#334155',
    background: '#e2e8f0',
  };
}

function buildStatusStyle(meta: StatusMeta): string {
  return `color:${meta.color};background:${meta.background};`;
}

function normalizeLine(raw: unknown): OrderDetailLineViewModel {
  const record = asRecord(raw);
  const status = pickRecordString(record, ['status', 'displayStatus', 'display_status'], 'pending');
  const meta = resolveStatusMeta(status);
  const orderedQty = toPositiveNumber(record.orderedQty ?? record.ordered_qty ?? record.quantity, 1);
  const procuredQty = toFiniteNumber(record.procuredQty ?? record.procured_qty);
  const receivedQty = toFiniteNumber(record.receivedQty ?? record.received_qty);
  const reservedQty = toFiniteNumber(record.reservedQty ?? record.reserved_qty);
  const shippedQty = toFiniteNumber(record.shippedQty ?? record.shipped_qty);
  const cancelledQty = toFiniteNumber(record.cancelledQty ?? record.cancelled_qty);

  return {
    id: pickRecordString(record, ['id']),
    title: pickRecordString(record, ['title', 'snapshotName', 'snapshot_name'], '未命名行项目'),
    status,
    statusLabel: meta.label,
    statusStyle: buildStatusStyle(meta),
    orderedQty,
    procuredQty,
    receivedQty,
    reservedQty,
    shippedQty,
    cancelledQty,
    imageUrl: pickRecordString(record, ['imageUrl', 'snapshotImage', 'snapshot_image']),
    metrics: [
      { label: '下单', value: orderedQty },
      { label: '采购', value: procuredQty },
      { label: '到货', value: receivedQty },
      { label: '预留', value: reservedQty },
      { label: '发货', value: shippedQty },
      { label: '取消', value: cancelledQty },
    ],
  };
}

function normalizeFile(raw: unknown): OrderDetailFileViewModel {
  const record = asRecord(raw);
  const url = pickRecordString(record, ['url']);
  const mimeType = resolveMimeType(record);
  const isImage = resolveImageFlag(mimeType, url);
  const isVideo = resolveVideoFlag(mimeType, url);

  return {
    id: pickRecordString(record, ['id'], url),
    name: pickRecordString(record, ['name'], '附件'),
    url,
    mimeType,
    size: toFiniteNumber(record.size),
    isImage,
    isVideo,
    typeLabel: isImage ? '图片' : isVideo ? '视频' : '文件',
  };
}

function buildTimelineTitle(record: UnknownRecord): string {
  const actionType = pickRecordString(record, ['actionType', 'action_type'], 'created');
  const actorName = pickRecordString(record, ['actorName', 'actor_name']);
  const fieldName = pickRecordString(record, ['fieldName', 'field_name']);
  const newValue = pickRecordString(record, ['newValue', 'new_value']);

  switch (actionType) {
    case 'created':
      return actorName ? `${actorName}创建了订单` : '订单已创建';
    case 'status_changed':
      return newValue ? `状态更新为${newValue}` : '订单状态已更新';
    case 'field_updated':
      return fieldName ? `${fieldName}已更新` : '订单信息已更新';
    case 'comment_added':
      return actorName ? `${actorName}新增留言` : '新增留言';
    default:
      return actorName ? `${actorName}更新了订单` : '订单动态';
  }
}

function buildTimelineContent(record: UnknownRecord): string {
  const comment = pickRecordString(record, ['comment']);
  if (comment) {
    return comment;
  }

  const fieldName = pickRecordString(record, ['fieldName', 'field_name']);
  const oldValue = pickRecordString(record, ['oldValue', 'old_value']);
  const newValue = pickRecordString(record, ['newValue', 'new_value']);
  if (fieldName && (oldValue || newValue)) {
    return `${fieldName}: ${oldValue || '-'} -> ${newValue || '-'}`;
  }

  const reason = pickRecordString(record, ['reason']);
  if (reason) {
    return reason;
  }

  return pickRecordString(record, ['newValue', 'new_value']);
}

function normalizeTimelineItem(raw: unknown): OrderDetailTimelineViewModel {
  const record = asRecord(raw);
  const createdAt = toFiniteNumber(record.createdAt ?? record.created_at);

  return {
    id: pickRecordString(record, ['id'], `${createdAt}`),
    title: buildTimelineTitle(record),
    content: buildTimelineContent(record),
    actorName: pickRecordString(record, ['actorName', 'actor_name']),
    createdAt,
    timeText: createdAt ? formatDateTime(createdAt) : '',
  };
}

function buildInfoRows(currentData: UnknownRecord): DetailInfoRow[] {
  return [
    { label: '品牌', value: pickRecordString(currentData, ['brand'], '未填写') },
    { label: '系列', value: pickRecordString(currentData, ['series'], '未填写') },
    { label: 'SKU', value: pickRecordString(currentData, ['sku'], '未填写') },
    { label: '尺寸', value: pickRecordString(currentData, ['size'], '未填写') },
    { label: '颜色', value: pickRecordString(currentData, ['color'], '未填写') },
    { label: '材质', value: pickRecordString(currentData, ['material'], '未填写') },
    { label: '期望到货', value: pickRecordString(currentData, ['deadline'], '未填写') },
    { label: '备注', value: pickRecordString(currentData, ['remark'], '未填写'), multiline: true },
  ];
}

export function buildOrderDetailViewModel(detail: unknown): OrderDetailViewModel {
  const record = asRecord(detail);
  const currentData = safeParseObject<UnknownRecord>(record.currentData ?? record.current_data, {});
  const lines = asArray(record.lines).map(normalizeLine);
  const files = asArray(record.files).map(normalizeFile).filter((item) => item.url);
  const timeline = asArray(record.timeline).map(normalizeTimelineItem);
  const header = asRecord(record.header);
  const status = pickFirstString([
    record.displayStatus,
    record.display_status,
    record.status,
  ], 'pending');
  const statusMeta = resolveStatusMeta(status);
  const quantity = toPositiveNumber(record.quantity ?? currentData.quantity, 1);

  return {
    summary: {
      orderNo: pickFirstString([record.orderNo, record.order_no]),
      title: pickFirstString([
        currentData.name,
        record.name,
        header.title,
        lines[0]?.title,
        record.orderNo,
        record.order_no,
      ], '未命名订单'),
      status,
      statusLabel: statusMeta.label,
      statusStyle: buildStatusStyle(statusMeta),
      quantity,
      mainImage: pickFirstString([
        header.mainImage,
        header.main_image,
        files[0]?.url,
        lines[0]?.imageUrl,
      ]),
      infoRows: buildInfoRows(currentData),
    },
    lines,
    files,
    timeline,
  };
}

export function buildDuplicatePrefill(detail: unknown): DuplicatePrefill {
  const record = asRecord(detail);
  const currentData = safeParseObject<UnknownRecord>(record.currentData ?? record.current_data, {});
  const files = asArray(record.files)
    .map(normalizeFile)
    .filter((item) => item.url)
    .map((item): DuplicatePrefillFile => ({
      id: item.id,
      url: item.url,
      name: item.name,
      type: item.isVideo ? 'video' : 'image',
      status: 'done',
      isLocal: false,
    }));

  const prefill: DuplicatePrefill = {
    name: pickRecordString(currentData, ['name']),
    brand: pickRecordString(currentData, ['brand']),
    series: pickRecordString(currentData, ['series']),
    sku: pickRecordString(currentData, ['sku']),
    size: pickRecordString(currentData, ['size']),
    color: pickRecordString(currentData, ['color']),
    material: pickRecordString(currentData, ['material']),
    remark: pickRecordString(currentData, ['remark']),
    deadline: pickRecordString(currentData, ['deadline']),
    quantity: toPositiveNumber(record.quantity ?? currentData.quantity, 1),
    files,
  };

  const productId = pickFirstString([record.productId, record.product_id]);
  const variantId = pickFirstString([record.variantId, record.variant_id]);

  if (productId) {
    prefill.productId = productId;
  }
  if (variantId) {
    prefill.variantId = variantId;
  }

  return prefill;
}
