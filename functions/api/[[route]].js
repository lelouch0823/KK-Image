/**
 * Hono API 入口点
 * Catch-all 路由，将所有 /api/* 请求转发到 Hono 框架
 * 
 * 重要：Cloudflare Pages Functions 将 context 对象传递给 onRequest 处理器，
 * 而 Hono 的 app.fetch 期望 (request, env, ctx) 签名。
 * 我们需要解包 Pages context 并正确传递参数。
 */
import app from '../lib/hono/app.js';


// Import new modules manually
import * as salespersonsIndex from './manage/salespersons/index.js';
import * as salespersonsId from './manage/salespersons/[id].js';
import * as ordersIndex from './manage/orders/index.js';
import * as ordersId from './manage/orders/[id].js';
import * as orderAuth from './order/[token]/auth.js';
import * as orderOrdersIndex from './order/[token]/orders/index.js';
import * as orderOrdersId from './order/[token]/orders/[id].js';

export async function onRequest(context) {
    const url = new URL(context.request.url);
    const path = url.pathname;
    const method = context.request.method;

    if (path === '/api/debug-ping') return new Response("New Route JS Loaded");

    // --- Salespersons (Admin) ---
    // GET /api/manage/salespersons
    // POST /api/manage/salespersons
    if (path.replace(/\/$/, '') === '/api/manage/salespersons') {
        if (method === 'GET') return salespersonsIndex.onRequestGet(context);
        if (method === 'POST') return salespersonsIndex.onRequestPost(context);
    }

    // /api/manage/salespersons/:id
    // /api/manage/salespersons/:id/reset-token
    const salesIdMatch = path.match(/^\/api\/manage\/salespersons\/([^/]+)(\/reset-token)?$/);
    if (salesIdMatch) {
        const id = salesIdMatch[1];
        const isResetToken = !!salesIdMatch[2];
        context.params = { ...context.params, id };

        if (isResetToken && method === 'POST') return salespersonsId.onRequestPost(context);
        if (!isResetToken) {
            if (method === 'GET') return salespersonsId.onRequestGet(context);
            if (method === 'PATCH') return salespersonsId.onRequestPatch(context);
            if (method === 'DELETE') return salespersonsId.onRequestDelete(context);
        }
    }

    // --- Orders (Admin) ---
    // GET /api/manage/orders
    if (path === '/api/manage/orders') {
        if (method === 'GET') return ordersIndex.onRequestGet(context);
    }

    // /api/manage/orders/:id
    // /api/manage/orders/:id/status
    // /api/manage/orders/:id/comment
    const manageOrderMatch = path.match(/^\/api\/manage\/orders\/([^/]+)(\/status|\/comment)?$/);
    if (manageOrderMatch) {
        const id = manageOrderMatch[1];
        const subAction = manageOrderMatch[2]; // /status or /comment
        context.params = { ...context.params, id };

        if (!subAction) {
            if (method === 'GET') return ordersId.onRequestGet(context);
            if (method === 'PATCH') return ordersId.onRequestPatch(context);
        } else if (subAction === '/status') {
            if (method === 'PATCH') return ordersId.onRequestPatch(context);
        } else if (subAction === '/comment') {
            if (method === 'POST') return ordersId.onRequestPost(context);
        }
    }

    // --- Sales Portal ---
    // /api/order/:token/auth
    const orderAuthMatch = path.match(/^\/api\/order\/([^/]+)\/auth$/);
    if (orderAuthMatch) {
        const token = orderAuthMatch[1];
        context.params = { ...context.params, token };
        if (method === 'GET') return orderAuth.onRequestGet(context);
        if (method === 'POST') return orderAuth.onRequestPost(context);
    }

    // /api/order/:token/orders
    const orderListMatch = path.match(/^\/api\/order\/([^/]+)\/orders$/);
    if (orderListMatch) {
        const token = orderListMatch[1];
        context.params = { ...context.params, token };
        if (method === 'GET') return orderOrdersIndex.onRequestGet(context);
        if (method === 'POST') return orderOrdersIndex.onRequestPost(context);
    }

    // /api/order/:token/orders/:id
    // /api/order/:token/orders/:id/comment
    // /api/order/:token/orders/:id/read
    const orderDetailMatch = path.match(/^\/api\/order\/([^/]+)\/orders\/([^/]+)(\/comment|\/read)?$/);
    if (orderDetailMatch) {
        const token = orderDetailMatch[1];
        const id = orderDetailMatch[2];
        const subAction = orderDetailMatch[3];
        context.params = { ...context.params, token, id };

        // For /read, it matches subAction /read
        // onRequestPatch in orderOrdersId handles patching (used for read)
        // onRequestPost handles POST (used for comment)
        // onRequestGet handles GET (used for details)

        if (!subAction) {
            if (method === 'GET') return orderOrdersId.onRequestGet(context);
        } else if (subAction === '/comment') {
            if (method === 'POST') return orderOrdersId.onRequestPost(context);
        } else if (subAction === '/read') {
            if (method === 'PATCH') return orderOrdersId.onRequestPatch(context);
        }
    }

    // Existing Logic (create executionCtx etc)
    const { request, env, waitUntil } = context;

    // 创建 Hono 期望的 executionContext 对象
    const executionCtx = {
        waitUntil: waitUntil.bind(context),
        passThroughOnException: () => { }
    };

    // 直接调用 Hono app.fetch 并传入正确的参数
    return app.fetch(request, env, executionCtx);
}
