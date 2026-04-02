import {
    pickFirstString,
    resolveFilePath,
    safeParseObject,
    toFiniteNumber,
} from '../helpers';

type UnknownRecord = Record<string, unknown>;

export interface NormalizedSalesOrderSummary {
    id: string;
    orderNo: string;
    title: string;
    quantity: number;
    status: string;
    hasNewFeedback: boolean;
    imageUrl: string;
    updatedAt: number;
    createdAt: number;
    productId: string;
    variantId: string;
}

export interface NormalizedSalesOrderLine {
    id: string;
    title: string;
    quantity: number;
    status: string;
    orderedQty: number;
    procuredQty: number;
    receivedQty: number;
    reservedQty: number;
    shippedQty: number;
    cancelledQty: number;
    imageUrl: string;
    productId: string;
    variantId: string;
}

export interface NormalizedSalesOrderFile {
    id: string;
    name: string;
    url: string;
    mimeType: string;
    size: number;
    section: string;
}

export interface NormalizedSalesOrderTimelineItem {
    id: string;
    actionType: string;
    actorType: string;
    actorName: string;
    comment: string;
    fieldName: string;
    oldValue: string;
    newValue: string;
    reason: string;
    createdAt: number;
}

export interface NormalizedSalesOrderDetail {
    id: string;
    orderNo: string;
    status: string;
    rawStatus: string;
    procurementStatus: string;
    displayStatus: string;
    quantity: number;
    currentData: UnknownRecord;
    header: {
        title: string;
        orderNo: string;
        status: string;
        rawStatus: string;
        procurementStatus: string;
        quantity: number;
        createdAt: number;
        updatedAt: number;
        mainImage: string;
    };
    lines: NormalizedSalesOrderLine[];
    files: NormalizedSalesOrderFile[];
    timeline: NormalizedSalesOrderTimelineItem[];
    customer: UnknownRecord | null;
    productId: string;
    variantId: string;
    createdAt: number;
    updatedAt: number;
    unreadByAdmin: boolean;
    unreadBySales: boolean;
}

function asRecord(value: unknown): UnknownRecord {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
        return value as UnknownRecord;
    }
    return {};
}

function asArray(value: unknown): unknown[] {
    return Array.isArray(value) ? value : [];
}

function toBoolean(value: unknown): boolean {
    return value === true || value === 1 || value === '1';
}

function resolveCurrentData(raw: UnknownRecord): UnknownRecord {
    return safeParseObject(
        raw.currentData ?? raw.current_data,
        {}
    );
}

function resolveOrderTitle(raw: UnknownRecord, currentData: UnknownRecord, lines: NormalizedSalesOrderLine[]): string {
    return pickFirstString([
        currentData.name,
        raw.name,
        raw.productName,
        raw.product_name,
        raw.orderNo,
        raw.order_no,
        lines[0]?.title,
    ], '未命名订单');
}

function resolveOrderStatus(raw: UnknownRecord): string {
    return pickFirstString([
        raw.displayStatus,
        raw.display_status,
        raw.procurementStatus,
        raw.procurement_status,
        raw.status,
    ], 'pending');
}

function normalizeSalesOrderFile(raw: unknown): NormalizedSalesOrderFile {
    const record = asRecord(raw);
    return {
        id: pickFirstString([record.id]),
        name: pickFirstString([record.name], '未命名文件'),
        url: resolveFilePath(record.url, record.storage_key),
        mimeType: pickFirstString([record.mimeType, record.mime_type]),
        size: toFiniteNumber(record.size),
        section: pickFirstString([record.section]),
    };
}

function normalizeSalesOrderTimelineItem(raw: unknown): NormalizedSalesOrderTimelineItem {
    const record = asRecord(raw);
    return {
        id: pickFirstString([record.id]),
        actionType: pickFirstString([record.actionType, record.action_type], 'created'),
        actorType: pickFirstString([record.actorType, record.actor_type]),
        actorName: pickFirstString([record.actorName, record.actor_name]),
        comment: pickFirstString([record.comment]),
        fieldName: pickFirstString([record.fieldName, record.field_name]),
        oldValue: pickFirstString([record.oldValue, record.old_value]),
        newValue: pickFirstString([record.newValue, record.new_value]),
        reason: pickFirstString([record.reason]),
        createdAt: toFiniteNumber(record.createdAt ?? record.created_at),
    };
}

export function normalizeSalesOrderLine(raw: unknown): NormalizedSalesOrderLine {
    const record = asRecord(raw);
    return {
        id: pickFirstString([record.id]),
        title: pickFirstString([record.snapshotName, record.snapshot_name], '未命名行项目'),
        quantity: toFiniteNumber(record.orderedQuantity ?? record.ordered_qty, 1),
        status: pickFirstString([record.displayStatus, record.display_status], 'pending'),
        orderedQty: toFiniteNumber(record.orderedQuantity ?? record.ordered_qty),
        procuredQty: toFiniteNumber(record.procuredQuantity ?? record.procured_qty),
        receivedQty: toFiniteNumber(record.receivedQuantity ?? record.received_qty),
        reservedQty: toFiniteNumber(record.reservedQuantity ?? record.reserved_qty),
        shippedQty: toFiniteNumber(record.shippedQuantity ?? record.shipped_qty),
        cancelledQty: toFiniteNumber(record.cancelledQuantity ?? record.cancelled_qty),
        imageUrl: resolveFilePath(record.snapshotImage ?? record.snapshot_image),
        productId: pickFirstString([record.productId, record.product_id]),
        variantId: pickFirstString([record.variantId, record.variant_id]),
    };
}

export function normalizeSalesOrderSummary(raw: unknown): NormalizedSalesOrderSummary {
    const record = asRecord(raw);
    const currentData = resolveCurrentData(record);
    const lines = asArray(record.lines).map(normalizeSalesOrderLine);
    return {
        id: pickFirstString([record.id]),
        orderNo: pickFirstString([record.orderNo, record.order_no]),
        title: resolveOrderTitle(record, currentData, lines),
        quantity: toFiniteNumber(record.quantity ?? currentData.quantity, 1),
        status: resolveOrderStatus(record),
        hasNewFeedback: toBoolean(
            record.hasNewFeedback
            ?? record.is_unread
            ?? record.unreadBySales
            ?? record.unread_by_sales
        ),
        imageUrl: resolveFilePath(
            record.mainImage ?? record.mainImageUrl ?? record.main_image,
            record.main_image_key
        ),
        updatedAt: toFiniteNumber(record.updatedAt ?? record.updated_at ?? record.createdAt ?? record.created_at),
        createdAt: toFiniteNumber(record.createdAt ?? record.created_at),
        productId: pickFirstString([record.productId, record.product_id]),
        variantId: pickFirstString([record.variantId, record.variant_id]),
    };
}

export function normalizeSalesOrderDetail(raw: unknown): NormalizedSalesOrderDetail {
    const record = asRecord(raw);
    const currentData = resolveCurrentData(record);
    const lines = asArray(record.lines).map(normalizeSalesOrderLine);
    const files = asArray(record.files).map(normalizeSalesOrderFile);
    const timeline = asArray(record.timeline).map(normalizeSalesOrderTimelineItem);
    const rawStatus = pickFirstString([record.status], 'pending');
    const procurementStatus = pickFirstString([
        record.procurementStatus,
        record.procurement_status,
    ], rawStatus);
    const displayStatus = resolveOrderStatus(record);
    const quantity = toFiniteNumber(record.quantity ?? currentData.quantity, 1);
    const title = resolveOrderTitle(record, currentData, lines);

    return {
        id: pickFirstString([record.id]),
        orderNo: pickFirstString([record.orderNo, record.order_no]),
        status: displayStatus,
        rawStatus,
        procurementStatus,
        displayStatus,
        quantity,
        currentData,
        header: {
            title,
            orderNo: pickFirstString([record.orderNo, record.order_no]),
            status: displayStatus,
            rawStatus,
            procurementStatus,
            quantity,
            createdAt: toFiniteNumber(record.createdAt ?? record.created_at),
            updatedAt: toFiniteNumber(record.updatedAt ?? record.updated_at),
            mainImage: resolveFilePath(
                record.mainImage ?? record.main_image,
                record.main_image_key
            ) || files[0]?.url || '',
        },
        lines,
        files,
        timeline,
        customer: (() => {
            const customer = asRecord(record.customer);
            return Object.keys(customer).length > 0 ? customer : null;
        })(),
        productId: pickFirstString([record.productId, record.product_id]),
        variantId: pickFirstString([record.variantId, record.variant_id]),
        createdAt: toFiniteNumber(record.createdAt ?? record.created_at),
        updatedAt: toFiniteNumber(record.updatedAt ?? record.updated_at),
        unreadByAdmin: toBoolean(record.unreadByAdmin ?? record.unread_by_admin),
        unreadBySales: toBoolean(record.unreadBySales ?? record.unread_by_sales),
    };
}

export function normalizeSalesOrdersPage(raw: unknown): {
    orders: NormalizedSalesOrderSummary[];
    pagination: { page: number; limit: number; total: number; totalPages: number };
} {
    const record = asRecord(raw);
    const pagination = asRecord(record.pagination);
    return {
        orders: asArray(record.orders).map(normalizeSalesOrderSummary),
        pagination: {
            page: toFiniteNumber(pagination.page, 1),
            limit: toFiniteNumber(pagination.limit, 20),
            total: toFiniteNumber(pagination.total),
            totalPages: toFiniteNumber(pagination.totalPages ?? pagination.total_pages, 1),
        },
    };
}
