import {
    salesRequest,
    type SalesRequestOptions,
    type SalesRequestResult,
} from '../http/request';
import { SALES_API } from '../../utils/constants';

type RequestFn = <T>(options: SalesRequestOptions) => Promise<SalesRequestResult<T>>;

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

export interface SalesProfile {
    id: string;
    name: string;
    store?: string;
    phone?: string;
}

async function defaultGetWechatCode(): Promise<string> {
    return new Promise((resolve) => {
        wx.login({
            success: (res) => resolve(String(res.code || '')),
            fail: () => resolve(''),
        });
    });
}

export async function getCurrentSalesProfile(
    input: { accessToken: string },
    request: RequestFn = salesRequest
): Promise<SalesRequestResult<SalesProfile>> {
    const result = await request<SalesProfile>({
        path: SALES_API.auth(input.accessToken),
        method: 'GET',
    });

    if (!result.success || !result.data) {
        return withoutData(result);
    }

    return withData(result, {
        id: String(result.data.id || ''),
        name: String(result.data.name || ''),
        store: result.data.store,
        phone: result.data.phone,
    });
}

export async function bindSalesWechat(
    { accessToken }: { accessToken: string },
    {
        request = salesRequest as RequestFn,
        getWechatCode = defaultGetWechatCode,
    }: {
        request?: RequestFn;
        getWechatCode?: () => Promise<string>;
    } = {}
): Promise<SalesRequestResult<null>> {
    const code = await getWechatCode();
    if (!code) {
        return {
            success: false,
            data: null,
            error: '获取微信登录凭证失败',
            code: 'WECHAT_CODE_MISSING',
            status: 0,
            detail: null,
            payload: {},
        };
    }

    return request<null>({
        path: SALES_API.bindWechat(accessToken),
        method: 'POST',
        data: { code },
    });
}
