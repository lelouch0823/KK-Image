import {
    salesRequest,
    type SalesRequestOptions,
    type SalesRequestResult,
} from '../http/request';
import { SALES_API } from '../../utils/constants';

type RequestFn = <T>(options: SalesRequestOptions) => Promise<SalesRequestResult<T>>;

export interface SalesStatsPayload {
    totalOrders: number;
    completedOrders: number;
    monthOrders: number;
    monthlyTrend: Array<{ date: string; count: number }>;
}

export async function loadSalesStats(
    input: { accessToken: string },
    request: RequestFn = salesRequest
): Promise<SalesRequestResult<SalesStatsPayload>> {
    return request<SalesStatsPayload>({
        path: SALES_API.stats(input.accessToken),
        method: 'GET',
    });
}
