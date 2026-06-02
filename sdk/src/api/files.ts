// 自动生成的 文件管理 API 模块 - 请勿手动修改
// 由 scripts/generate-sdk.js 生成

import type { ApiClient } from '../client.js';
import type { CreateFileRequest, ListFilesQuery, UpdateFileRequest } from '../types/index.js';

/** 文件管理 API */
export class FilesApi {
  constructor(private client: ApiClient) {}

  /** 文件列表 */
  async listFiles(query?: ListFilesQuery): Promise<unknown> {
    return this.client.request('GET', '/manage/files', { query: query as Record<string, unknown> });
  }

  /** 创建文件记录 */
  async createFiles(body: CreateFileRequest): Promise<unknown> {
    return this.client.request('POST', '/manage/files', { body });
  }

  /** 更新文件 */
  async updateFiles(id: string, body: UpdateFileRequest): Promise<unknown> {
    return this.client.request('PATCH', `/manage/files/${id}`, { body });
  }

}