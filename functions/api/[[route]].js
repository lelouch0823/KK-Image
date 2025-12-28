/**
 * Hono API 入口点
 * Catch-all 路由，将所有 /api/* 请求转发到 Hono 框架
 */
import app from '../lib/hono/app.js';

export const onRequest = app.fetch;
