/**
 * Hono API 入口点
 * Catch-all 路由，将所有 /api/* 请求转发到 Hono 框架
 * 
 * 重要：Cloudflare Pages Functions 将 context 对象传递给 onRequest 处理器，
 * 而 Hono 的 app.fetch 期望 (request, env, ctx) 签名。
 * 我们需要解包 Pages context 并正确传递参数。
 */
import app from '../lib/hono/app.js';

export async function onRequest(context) {
    const { request, env, waitUntil } = context;

    // 创建 Hono 期望的 executionContext 对象
    const executionCtx = {
        waitUntil: waitUntil.bind(context),
        passThroughOnException: () => { }
    };

    // 直接调用 Hono app.fetch 并传入正确的参数
    return app.fetch(request, env, executionCtx);
}
