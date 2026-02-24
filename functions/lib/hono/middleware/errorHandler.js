/**
 * 全局错误处理句柄 (app.onError)
 * 接管所有抛出的异常并标准化返回
 */
export function errorHandler(err, c) {
  console.error('[GlobalErrorHandler]', err.name, err.message, err.stack);

  // 根据错误类型确定状态码 (保留对旧报错的兼容性)
  const statusMap = {
    ValidationError: 400,
    AuthenticationError: 401,
    AuthorizationError: 403,
    NotFoundError: 404,
    ConflictError: 409,
    RateLimitError: 429,
  };

  const status = err.statusCode || statusMap[err.name] || 500;
  const message = status === 500 && !err.statusCode ? 'Internal Server Error' : err.message;

  return c.json(
    {
      success: false,
      error: message,
      code: err.code || err.name || 'INTERNAL_ERROR',
      ...(c.env?.NODE_ENV === 'development' && { stack: err.stack }),
    },
    status
  );
}
