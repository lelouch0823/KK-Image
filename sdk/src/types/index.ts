// 自动生成的类型定义 - 请勿手动修改
// 由 scripts/generate-sdk.js 生成

/** GET /manage/files 查询参数 */
export interface ListFilesQuery {
  page?: number;
  limit?: number;
}

/** POST /manage/files 请求体 */
export interface CreateFileRequest {
  name: string;
  size?: number;
  folderId?: string;
}

/** PATCH /manage/files/{id} 请求体 */
export interface UpdateFileRequest {
  name?: string;
}
