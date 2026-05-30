/**
 * 统一错误码常量
 *
 * 全项目使用同一套错误码枚举，消除硬编码字符串。
 * 用于 errorCode ref 的值，以及视图层的条件判断。
 */

export const ErrorCode = Object.freeze({
  /** HTTP 401 - 未认证 */
  UNAUTHORIZED: 'UNAUTHORIZED',
  /** HTTP 403 - 无权限 */
  FORBIDDEN: 'FORBIDDEN',
  /** HTTP 5xx - 服务器错误 */
  SERVER_ERROR: 'SERVER_ERROR',
  /** 网络异常 / 超时 / 其他 */
  NETWORK_ERROR: 'NETWORK_ERROR',
});

/**
 * 判断 errorCode 是否为权限类错误（视图层应显示专属 UI，不弹 toast）
 */
export function isAuthError(code) {
  return code === ErrorCode.UNAUTHORIZED || code === ErrorCode.FORBIDDEN;
}

/**
 * 判断 errorCode 是否为可重试错误
 */
export function isRetryable(code) {
  return code === ErrorCode.SERVER_ERROR || code === ErrorCode.NETWORK_ERROR;
}
