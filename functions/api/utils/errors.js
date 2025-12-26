/**
 * @fileoverview 自定义错误类模块 - 提供类型化的错误处理
 * @module api/utils/errors
 */

/**
 * 基础 API 错误类
 * @extends Error
 */
export class ApiError extends Error {
    /**
     * @param {string} message - 错误消息
     * @param {number} [statusCode=500] - HTTP 状态码
     * @param {string} [code='INTERNAL_ERROR'] - 错误类型代码
     */
    constructor(message, statusCode = 500, code = 'INTERNAL_ERROR') {
        super(message);
        /** @type {string} */
        this.name = 'ApiError';
        /** @type {number} */
        this.statusCode = statusCode;
        /** @type {string} */
        this.code = code;
        /** @type {string} */
        this.timestamp = new Date().toISOString();
    }

    /**
     * 转换为 JSON 格式
     * @returns {{error: {code: number, message: string, type: string, timestamp: string}}}
     */
    toJSON() {
        return {
            error: {
                code: this.statusCode,
                message: this.message,
                type: this.code,
                timestamp: this.timestamp
            }
        };
    }
}

/**
 * 验证错误 - 400 Bad Request
 */
export class ValidationError extends ApiError {
    constructor(message, details = null) {
        super(message, 400, 'VALIDATION_ERROR');
        this.name = 'ValidationError';
        this.details = details;
    }

    toJSON() {
        const json = super.toJSON();
        if (this.details) {
            json.error.details = this.details;
        }
        return json;
    }
}

/**
 * 认证错误 - 401 Unauthorized
 */
export class AuthenticationError extends ApiError {
    constructor(message = 'Authentication required') {
        super(message, 401, 'AUTHENTICATION_ERROR');
        this.name = 'AuthenticationError';
    }
}

/**
 * 授权错误 - 403 Forbidden
 */
export class AuthorizationError extends ApiError {
    constructor(message = 'Insufficient permissions', requiredPermission = null) {
        super(message, 403, 'AUTHORIZATION_ERROR');
        this.name = 'AuthorizationError';
        this.requiredPermission = requiredPermission;
    }

    toJSON() {
        const json = super.toJSON();
        if (this.requiredPermission) {
            json.error.requiredPermission = this.requiredPermission;
        }
        return json;
    }
}

/**
 * 资源未找到错误 - 404 Not Found
 */
export class NotFoundError extends ApiError {
    constructor(message = 'Resource not found', resourceType = null) {
        super(message, 404, 'NOT_FOUND');
        this.name = 'NotFoundError';
        this.resourceType = resourceType;
    }
}

/**
 * 冲突错误 - 409 Conflict
 */
export class ConflictError extends ApiError {
    constructor(message = 'Resource already exists') {
        super(message, 409, 'CONFLICT');
        this.name = 'ConflictError';
    }
}

/**
 * 速率限制错误 - 429 Too Many Requests
 */
export class RateLimitError extends ApiError {
    constructor(message = 'Rate limit exceeded', retryAfter = null) {
        super(message, 429, 'RATE_LIMIT_EXCEEDED');
        this.name = 'RateLimitError';
        this.retryAfter = retryAfter;
    }

    toJSON() {
        const json = super.toJSON();
        if (this.retryAfter) {
            json.error.retryAfter = this.retryAfter;
        }
        return json;
    }
}

/**
 * 配置错误 - 500 Internal Server Error
 */
export class ConfigurationError extends ApiError {
    constructor(message = 'Service not properly configured') {
        super(message, 500, 'CONFIGURATION_ERROR');
        this.name = 'ConfigurationError';
    }
}

/**
 * 错误处理辅助函数 - 将错误转换为 Response
 */
export function errorToResponse(error, corsHeaders = {}) {
    // 如果是自定义 ApiError
    if (error instanceof ApiError) {
        return new Response(JSON.stringify(error.toJSON()), {
            status: error.statusCode,
            headers: {
                'Content-Type': 'application/json',
                ...corsHeaders
            }
        });
    }

    // 处理旧式的 error.name 修改方式（向后兼容）
    const errorMapping = {
        'ValidationError': 400,
        'AuthenticationError': 401,
        'AuthorizationError': 403,
        'NotFoundError': 404,
        'ConflictError': 409,
        'RateLimitError': 429
    };

    const status = errorMapping[error.name] || 500;
    const message = status === 500 ? 'Internal Server Error' : error.message;

    return new Response(JSON.stringify({
        error: {
            code: status,
            message: message,
            timestamp: new Date().toISOString()
        }
    }), {
        status,
        headers: {
            'Content-Type': 'application/json',
            ...corsHeaders
        }
    });
}
