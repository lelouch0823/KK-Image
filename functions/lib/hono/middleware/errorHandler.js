/**
 * 统一错误处理中间件
 * 捕获所有未处理的错误并返回标准格式响应
 */
export async function errorHandler(c, next) {
  try {
    await next();
  } catch (err) {
    console.error('[ErrorHandler]', err.message, err.stack);

    // 根据错误类型确定状态码
    const statusMap = {
      ValidationError: 400,
      AuthenticationError: 401,
      AuthorizationError: 403,
      NotFoundError: 404,
      ConflictError: 409,
      RateLimitError: 429,
    };

    const status = err.statusCode || statusMap[err.name] || 500;
    const message = status === 500 ? 'Internal Server Error' : err.message;

    return c.json(
      {
        success: false,
        error: message,
        code: err.code || err.name || 'INTERNAL_ERROR',
        ...(c.env.NODE_ENV === 'development' && { stack: err.stack }),
      },
      status
    );
  }
}
