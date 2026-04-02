import {
    pickFirstString,
    safeParseObject,
    toFiniteNumber,
} from '../helpers';

type UnknownRecord = Record<string, unknown>;

export interface NormalizedSalesNotification {
    id: string;
    type: string;
    title: string;
    content: string;
    link: string;
    isRead: boolean;
    unread: boolean;
    is_read: number;
    receiver: string;
    orderId: string;
    metadata: Record<string, unknown> | null;
    createdAt: number;
    created_at: number;
}

function asRecord(value: unknown): UnknownRecord {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
        return value as UnknownRecord;
    }
    return {};
}

function normalizeMetadata(value: unknown): Record<string, unknown> | null {
    if (!value) {
        return null;
    }
    const parsed = safeParseObject(asRecord(value), {});
    return Object.keys(parsed).length > 0 ? parsed : null;
}

function isUnread(value: unknown): boolean {
    return !(value === true || value === 1 || value === '1');
}

export function normalizeSalesNotification(raw: unknown): NormalizedSalesNotification {
    const record = asRecord(raw);
    const unread = isUnread(record.isRead ?? record.is_read);
    const createdAt = toFiniteNumber(record.createdAt ?? record.created_at);
    return {
        id: pickFirstString([record.id]),
        type: pickFirstString([record.type], 'system'),
        title: pickFirstString([record.title]),
        content: pickFirstString([record.content]),
        link: pickFirstString([record.link]),
        isRead: !unread,
        unread,
        is_read: unread ? 0 : 1,
        receiver: pickFirstString([record.receiver], 'sales'),
        orderId: pickFirstString([record.orderId, record.order_id]),
        metadata: normalizeMetadata(record.metadata),
        createdAt,
        created_at: createdAt,
    };
}

export function normalizeSalesNotificationsPayload(raw: unknown): {
    list: NormalizedSalesNotification[];
    unreadCount: number;
} {
    const record = asRecord(raw);
    const list = (Array.isArray(raw) ? raw : (Array.isArray(record.list) ? record.list : []))
        .map(normalizeSalesNotification);
    const unreadCount = record.unreadCount != null
        ? toFiniteNumber(record.unreadCount)
        : list.filter((item) => item.unread).length;

    return {
        list,
        unreadCount,
    };
}
