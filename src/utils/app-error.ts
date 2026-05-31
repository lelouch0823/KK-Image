/**
 * 应用层错误类型
 *
 * 扩展标准 Error，添加 HTTP 状态码和响应数据。
 * 统一 http-core / api-helpers / useAsyncState 中的错误格式。
 */
export interface AppErrorData {
  error?: string;
  message?: string;
  [key: string]: unknown;
}

export class AppError extends Error {
  status: number;
  data: AppErrorData;
  code?: string;

  constructor(message: string, status: number, data: AppErrorData = {}) {
    super(message);
    this.name = 'AppError';
    this.status = status;
    this.data = data;
  }
}

/**
 * 类型守卫：判断是否为 AppError
 */
export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}
