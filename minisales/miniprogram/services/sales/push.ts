/**
 * 微信小程序订阅消息服务
 * 用于订单状态变更等消息推送
 */

import {
    salesRequest,
    type SalesRequestOptions,
    type SalesRequestResult,
} from '../http/request';
import { SALES_API } from '../../utils/constants';

type RequestFn = <T>(options: SalesRequestOptions) => Promise<SalesRequestResult<T>>;

// 订阅消息模板 ID 配置
// 需要在微信公众平台配置后填入实际模板 ID
export const SUBSCRIBE_TEMPLATES = {
    ORDER_STATUS_CHANGE: '', // 订单状态变更通知
    ORDER_CREATED: '',       // 订单创建通知
    ORDER_ARRIVED: '',       // 到货通知
} as const;

export interface SubscribeMessageInput {
    accessToken: string;
    templateId: string;
    orderId: string;
    status: string;
    remark?: string;
}

/**
 * 请求订阅消息授权
 * 调用 wx.requestSubscribeMessage 获取用户授权
 */
export function requestSubscribeAuth(
    templateIds: string[]
): Promise<{ success: boolean; failedIds: string[] }> {
    return new Promise((resolve) => {
        if (!templateIds.length) {
            resolve({ success: true, failedIds: [] });
            return;
        }

        wx.requestSubscribeMessage({
            tmplIds: templateIds,
            success: () => {
                resolve({ success: true, failedIds: [] });
            },
            fail: (err) => {
                // 用户拒绝授权或系统错误
                console.warn('订阅消息授权失败:', err);
                resolve({ success: false, failedIds: templateIds });
            },
        });
    });
}

/**
 * 发送订阅消息（服务端）
 * 通知后端发送微信订阅消息给用户
 */
export async function sendSubscribeNotification(
    input: SubscribeMessageInput,
    request: RequestFn = salesRequest
): Promise<SalesRequestResult<null>> {
    return request<null>({
        path: `${SALES_API.orders(input.accessToken)}/${input.orderId}/notify`,
        method: 'POST',
        data: {
            templateId: input.templateId,
            status: input.status,
            remark: input.remark || '',
        },
    });
}

/**
 * 订单状态变更时请求订阅授权并发送通知
 */
export async function notifyOrderStatusChange(
    accessToken: string,
    orderId: string,
    newStatus: string
): Promise<void> {
    const templateId = SUBSCRIBE_TEMPLATES.ORDER_STATUS_CHANGE;
    if (!templateId) {
        return;
    }

    // 先请求授权
    const authResult = await requestSubscribeAuth([templateId]);
    if (!authResult.success) {
        return;
    }

    // 发送通知
    await sendSubscribeNotification({
        accessToken,
        templateId,
        orderId,
        status: newStatus,
    });
}

/**
 * 检查订阅消息授权状态
 */
export function checkSubscribePermission(
    templateId: string
): Promise<boolean> {
    return new Promise((resolve) => {
        wx.getSetting({
            withSubscriptions: true,
            success: (res) => {
                const subscriptionsSetting = res.subscriptionsSetting;
                if (!subscriptionsSetting) {
                    resolve(false);
                    return;
                }

                const mainSwitch = subscriptionsSetting.mainSwitch;
                if (!mainSwitch) {
                    resolve(false);
                    return;
                }

                const itemSettings = subscriptionsSetting.itemSettings;
                if (!itemSettings) {
                    resolve(false);
                    return;
                }

                // accept 表示用户同意
                resolve(itemSettings[templateId] === 'accept');
            },
            fail: () => {
                resolve(false);
            },
        });
    });
}
