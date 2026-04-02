import {
    salesRequest,
    type SalesRequestOptions,
    type SalesRequestResult,
} from '../http/request';
import { SALES_API } from '../../utils/constants';
import { buildQueryString } from '../../utils/helpers';
import { normalizeSalesNotificationsPayload } from '../../utils/normalize/notification';

type RequestFn = <T>(options: SalesRequestOptions) => Promise<SalesRequestResult<T>>;

function withData<T, U>(result: SalesRequestResult<T>, data: U | null): SalesRequestResult<U> {
    return {
        ...result,
        data,
    };
}

export async function loadSalesNotifications(
    input: { accessToken: string; limit?: number; unreadOnly?: boolean },
    request: RequestFn = salesRequest
): Promise<SalesRequestResult<{ list: ReturnType<typeof normalizeSalesNotificationsPayload>['list']; unreadCount: number }>> {
    const suffix = buildQueryString({
        limit: input.limit,
        unread_only: input.unreadOnly ? 'true' : '',
    });
    const result = await request<unknown>({
        path: suffix ? `${SALES_API.notifications(input.accessToken)}?${suffix}` : SALES_API.notifications(input.accessToken),
        method: 'GET',
    });

    if (!result.success || !result.data) {
        return withData(result, null);
    }

    return withData(result, normalizeSalesNotificationsPayload(result.data));
}

export async function markSalesNotificationRead(
    input: { accessToken: string; notificationId: string },
    request: RequestFn = salesRequest
): Promise<SalesRequestResult<null>> {
    return request<null>({
        path: SALES_API.notificationRead(input.accessToken, input.notificationId),
        method: 'POST',
    });
}

export async function markAllSalesNotificationsRead(
    input: { accessToken: string },
    request: RequestFn = salesRequest
): Promise<SalesRequestResult<null>> {
    return markSalesNotificationRead(
        { accessToken: input.accessToken, notificationId: 'all' },
        request
    );
}

export function countUnreadNotifications(
    payload: { list?: Array<{ unread?: boolean; isRead?: boolean; is_read?: number }>; unreadCount?: number } | null | undefined
): number {
    if (!payload) {
        return 0;
    }
    if (typeof payload.unreadCount === 'number') {
        return payload.unreadCount;
    }
    return (payload.list || []).filter((item) => item.unread ?? !(item.isRead ?? item.is_read === 1)).length;
}
