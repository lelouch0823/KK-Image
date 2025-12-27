/**
 * @fileoverview 响应处理工具函数
 */

/**
 * 返回 JSON 响应
 * @param {any} data - 响应数据
 * @param {number} [status=200] - HTTP 状态码
 * @param {object} [headers={}] - 额外响应头
 * @returns {Response}
 */
export function jsonResponse(data, status = 200, headers = {}) {
    return new Response(JSON.stringify(data), {
        status,
        headers: {
            'Content-Type': 'application/json;charset=UTF-8',
            ...headers
        }
    });
}

/**
 * 成功响应封装
 * @param {any} data - 数据内容
 * @param {string} [message] - 可选消息
 * @returns {Response}
 */
export function success(data, message = 'Success', status = 200, headers = {}) {
    return jsonResponse({
        success: true,
        message,
        data
    }, status, headers);
}

/**
 * 错误响应封装
 * @param {string} message - 错误信息
 * @param {number} [status=400] - 状态码
 * @returns {Response}
 */
export function error(message, status = 400) {
    return jsonResponse({
        success: false,
        message
    }, status);
}
