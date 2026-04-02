import {
    salesRequest,
    type SalesRequestOptions,
    type SalesRequestResult,
} from '../http/request';
import { SALES_API } from '../../utils/constants';
import { buildQueryString, toFiniteNumber } from '../../utils/helpers';
import {
    normalizeSalesProductDetail,
    normalizeSalesProductSummary,
    pickSelectableProductVariants,
    type NormalizedSalesProductDetail,
    type NormalizedSalesProductSummary,
    type NormalizedSalesProductVariant,
    type VariantSelectPolicy,
} from '../../utils/normalize/product';

type RequestFn = <T>(options: SalesRequestOptions) => Promise<SalesRequestResult<T>>;

function withData<T, U>(result: SalesRequestResult<T>, data: U | null): SalesRequestResult<U> {
    return {
        ...result,
        data,
    };
}

export async function loadProductList(
    input: { accessToken: string; search?: string; page?: number; limit?: number },
    request: RequestFn = salesRequest
): Promise<SalesRequestResult<{ items: NormalizedSalesProductSummary[]; meta: { total: number; page: number; limit: number } }>> {
    const query = buildQueryString({
        search: input.search || '',
        page: input.page || 1,
        limit: input.limit || 12,
    });
    const result = await request<unknown[]>({
        path: `${SALES_API.products(input.accessToken)}?${query}`,
        method: 'GET',
    });

    if (!result.success) {
        return withData(result, null);
    }

    const payloadMeta = result.payload.meta as Record<string, unknown> | undefined;
    return withData(result, {
        items: Array.isArray(result.data) ? result.data.map(normalizeSalesProductSummary) : [],
        meta: {
            total: toFiniteNumber(payloadMeta?.total),
            page: toFiniteNumber(payloadMeta?.page, input.page || 1),
            limit: toFiniteNumber(payloadMeta?.limit, input.limit || 12),
        },
    });
}

export async function loadProductDetail(
    input: { accessToken: string; productId: string },
    request: RequestFn = salesRequest
): Promise<SalesRequestResult<NormalizedSalesProductDetail>> {
    const result = await request<unknown>({
        path: SALES_API.productById(input.accessToken, input.productId),
        method: 'GET',
    });

    if (!result.success || !result.data) {
        return withData(result, null);
    }

    return withData(result, normalizeSalesProductDetail(result.data));
}

export function pickSelectableVariants(
    productOrVariants: NormalizedSalesProductDetail | NormalizedSalesProductVariant[] | null | undefined,
    policy: VariantSelectPolicy = 'in_stock_only'
): NormalizedSalesProductVariant[] {
    if (Array.isArray(productOrVariants)) {
        return pickSelectableProductVariants(productOrVariants, policy);
    }
    if (!productOrVariants) {
        return [];
    }
    return pickSelectableProductVariants(productOrVariants.variants, policy);
}
