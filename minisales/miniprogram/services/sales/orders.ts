import {
    salesRequest,
    type SalesRequestOptions,
    type SalesRequestResult,
} from '../http/request';
import { SALES_API } from '../../utils/constants';
import { buildQueryString } from '../../utils/helpers';
import {
    normalizeSalesOrderDetail,
    normalizeSalesOrdersPage,
    type NormalizedSalesOrderDetail,
    type NormalizedSalesOrderSummary,
} from '../../utils/normalize/order';

type RequestFn = <T>(options: SalesRequestOptions) => Promise<SalesRequestResult<T>>;

export interface SalesPagination {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
}

export interface SalesOrdersPageData {
    orders: NormalizedSalesOrderSummary[];
    pagination: SalesPagination;
}

export interface CreateSalesOrderInput {
    accessToken: string;
    name: string;
    brand?: string;
    series?: string;
    sku?: string;
    size?: string;
    color?: string;
    material?: string;
    remark?: string;
    deadline?: string;
    quantity?: number;
    fileIds?: string[];
    productId?: string | null;
    variantId?: string | null;
}

export interface LoadSalesOrdersInput {
    accessToken: string;
    page?: number;
    limit?: number;
    search?: string;
}

function withData<T, U>(result: SalesRequestResult<T>, data: U | null): SalesRequestResult<U> {
    return {
        ...result,
        data,
    };
}

function withoutData<T, U>(result: SalesRequestResult<T>): SalesRequestResult<U> {
    return {
        ...result,
        data: null,
    };
}

function buildOrdersPath({ accessToken, page = 1, limit = 20, search = '' }: LoadSalesOrdersInput): string {
    const query = buildQueryString({ page, limit, search });
    return query ? `${SALES_API.orders(accessToken)}?${query}` : SALES_API.orders(accessToken);
}

function buildOrderWritePayload(input: CreateSalesOrderInput) {
    const payload: Record<string, unknown> = {
        name: input.name,
        brand: input.brand || '',
        series: input.series || '',
        sku: input.sku || '',
        size: input.size || '',
        color: input.color || '',
        material: input.material || '',
        remark: input.remark || '',
        deadline: input.deadline || '',
        quantity: Number(input.quantity || 1),
        fileIds: input.fileIds || [],
    };

    if (input.productId) {
        payload.productId = input.productId;
    }
    if (input.variantId) {
        payload.variantId = input.variantId;
    }

    return payload;
}

export async function loadSalesOrders(
    input: LoadSalesOrdersInput,
    request: RequestFn = salesRequest
): Promise<SalesRequestResult<SalesOrdersPageData>> {
    const result = await request<{ orders?: unknown[]; pagination?: Record<string, unknown> }>({
        path: buildOrdersPath(input),
        method: 'GET',
    });

    if (!result.success || !result.data) {
        return withoutData(result);
    }

    return withData(result, normalizeSalesOrdersPage(result.data));
}

export async function getSalesOrderDetail(
    input: { accessToken: string; orderId: string },
    request: RequestFn = salesRequest
): Promise<SalesRequestResult<NormalizedSalesOrderDetail>> {
    const result = await request<unknown>({
        path: SALES_API.orderById(input.accessToken, input.orderId),
        method: 'GET',
    });

    if (!result.success || !result.data) {
        return withoutData(result);
    }

    return withData(result, normalizeSalesOrderDetail(result.data));
}

export const loadSalesOrderDetail = getSalesOrderDetail;

export async function createSalesOrder(
    input: CreateSalesOrderInput,
    request: RequestFn = salesRequest
): Promise<SalesRequestResult<{ id: string; orderNo: string }>> {
    return request<{ id: string; orderNo: string }>({
        path: SALES_API.orders(input.accessToken),
        method: 'POST',
        data: buildOrderWritePayload(input),
    });
}

export async function markSalesOrderRead(
    input: { accessToken: string; orderId: string },
    request: RequestFn = salesRequest
): Promise<SalesRequestResult<null>> {
    return request<null>({
        path: SALES_API.orderRead(input.accessToken, input.orderId),
        method: 'PATCH' as SalesRequestOptions['method'],
    });
}

export async function addSalesOrderComment(
    input: { accessToken: string; orderId: string; comment: string },
    request: RequestFn = salesRequest
): Promise<SalesRequestResult<null>> {
    return request<null>({
        path: SALES_API.orderComment(input.accessToken, input.orderId),
        method: 'POST',
        data: { comment: input.comment },
    });
}

export async function updateSalesOrder(
    input: {
        accessToken: string;
        orderId: string;
        updates: Record<string, unknown>;
        reason?: string;
        fileIds?: string[];
        productId?: string | null;
        variantId?: string | null;
    },
    request: RequestFn = salesRequest
): Promise<SalesRequestResult<unknown>> {
    return request<unknown>({
        path: SALES_API.orderById(input.accessToken, input.orderId),
        method: 'PATCH' as SalesRequestOptions['method'],
        data: {
            updates: input.updates,
            reason: input.reason || '',
            ...(input.fileIds ? { fileIds: input.fileIds } : {}),
            ...(input.productId !== undefined ? { productId: input.productId } : {}),
            ...(input.variantId !== undefined ? { variantId: input.variantId } : {}),
        },
    });
}

export async function deleteSalesOrder(
    input: { accessToken: string; orderId: string },
    request: RequestFn = salesRequest
): Promise<SalesRequestResult<null>> {
    return request<null>({
        path: SALES_API.orderById(input.accessToken, input.orderId),
        method: 'DELETE',
    });
}
