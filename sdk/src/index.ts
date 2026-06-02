// 自动生成的 SDK 入口 - 请勿手动修改
// 由 scripts/generate-sdk.js 生成

export { HttpClient, ApiError } from './client.js';
export type { ClientConfig, ApiClient } from './client.js';
export * from './types/index.js';

export { FilesApi } from './api/files.js';
export { OrdersApi } from './api/orders.js';

import { HttpClient } from './client.js';
import type { ClientConfig } from './client.js';
import { FilesApi } from './api/files.js';
import { OrdersApi } from './api/orders.js';

/** KK-Image SDK 客户端 */
export class KKImageClient {
  private client: HttpClient;

  /** files API */
  readonly files: FilesApi;

  /** orders API */
  readonly orders: OrdersApi;

  constructor(config: ClientConfig) {
    this.client = new HttpClient(config);

    this.files = new FilesApi(this.client);
    this.orders = new OrdersApi(this.client);
  }

  /** 更新认证 Token */
  setToken(token: string): void {
    this.client.setToken(token);
  }
}
