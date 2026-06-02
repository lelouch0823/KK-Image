// 自动生成的 订单管理 API 模块 - 请勿手动修改
// 由 scripts/generate-sdk.js 生成

import type { ApiClient } from '../client.js';

/** 订单管理 API */
export class OrdersApi {
  constructor(private client: ApiClient) {}

  /** 订单列表 */
  async listOrders(): Promise<unknown> {
    return this.client.request('GET', '/manage/orders');
  }

}