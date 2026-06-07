/**
 * API 文档自动生成路由
 * 基于现有 Zod Schema 生成 OpenAPI 3.0 规范
 */

import { Hono } from 'hono';
import { zodSchemaToOpenAPI } from '../../utils/zod-to-openapi.js';

// 导入所有 Schema
import {
  CreateFileSchema,
  UpdateFileSchema,
  FileQuerySchema,
  BatchFileSchema,
  MoveFileSchema,
} from '../../schemas/file.js';
import {
  CreateFolderSchema,
  UpdateFolderSchema,
  FolderQuerySchema,
  ShareSettingsSchema,
} from '../../schemas/folder.js';
import {
  CreateAdminOrderSchema,
  UpdateAdminOrderSchema,
  UpdateOrderStatusSchema,
  BatchCreateOrderSchema,
  AddOrderCommentSchema,
} from '../../schemas/order.js';
import {
  CreateProductSchema,
  UpdateProductSchema,
  UpdateProductStatusSchema,
} from '../../schemas/product.js';
import {
  LoginSchema,
  CreateUserSchema,
  UpdateUserSchema,
  TokenSchema,
} from '../../schemas/user.js';

const app = new Hono();

/**
 * 构建 OpenAPI 3.0 规范
 */
function buildOpenAPISpec() {
  return {
    openapi: '3.0.3',
    info: {
      title: 'KK-Image 管理系统 API',
      description: '全栈 Cloudflare 原生管理系统 - 产品、销售、订单与预订管理',
      version: '2.0.0',
      contact: { name: 'KK-Image Team' },
    },
    servers: [{ url: '/api', description: '当前服务器' }],
    tags: [
      { name: '认证', description: '用户认证与授权' },
      { name: '文件管理', description: '文件上传、查询与管理' },
      { name: '文件夹管理', description: '文件夹 CRUD 操作' },
      { name: '订单管理', description: '订单创建、更新与状态流转' },
      { name: '商品管理', description: '商品与变体管理' },
      { name: '用户管理', description: '用户账户管理' },
    ],
    paths: {
      '/v1/auth/login': {
        post: {
          tags: ['认证'],
          summary: '管理员登录',
          requestBody: {
            required: true,
            content: { 'application/json': { schema: zodSchemaToOpenAPI(LoginSchema) } },
          },
          responses: {
            200: { description: '登录成功，返回 JWT Token' },
            401: { description: '用户名或密码错误' },
          },
        },
      },
      '/v1/auth/token': {
        post: {
          tags: ['认证'],
          summary: '生成 API Token',
          requestBody: {
            required: true,
            content: { 'application/json': { schema: zodSchemaToOpenAPI(TokenSchema) } },
          },
          responses: {
            200: { description: 'Token 生成成功' },
            401: { description: '认证失败' },
          },
        },
      },
      '/manage/files': {
        get: {
          tags: ['文件管理'],
          summary: '文件列表',
          parameters: objectToQueryParams(FileQuerySchema),
          responses: { 200: { description: '文件列表' } },
        },
        post: {
          tags: ['文件管理'],
          summary: '创建文件记录',
          requestBody: {
            required: true,
            content: { 'application/json': { schema: zodSchemaToOpenAPI(CreateFileSchema) } },
          },
          responses: { 201: { description: '创建成功' } },
        },
      },
      '/manage/files/batch': {
        post: {
          tags: ['文件管理'],
          summary: '批量文件操作',
          requestBody: {
            required: true,
            content: { 'application/json': { schema: zodSchemaToOpenAPI(BatchFileSchema) } },
          },
          responses: { 200: { description: '批量操作完成' } },
        },
      },
      '/manage/files/move': {
        post: {
          tags: ['文件管理'],
          summary: '移动文件',
          requestBody: {
            required: true,
            content: { 'application/json': { schema: zodSchemaToOpenAPI(MoveFileSchema) } },
          },
          responses: { 200: { description: '移动完成' } },
        },
      },
      '/manage/files/{id}': {
        patch: {
          tags: ['文件管理'],
          summary: '更新文件',
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
          requestBody: {
            content: { 'application/json': { schema: zodSchemaToOpenAPI(UpdateFileSchema) } },
          },
          responses: { 200: { description: '更新成功' } },
        },
        delete: {
          tags: ['文件管理'],
          summary: '删除文件',
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
          responses: { 200: { description: '删除成功' } },
        },
      },
      '/manage/folders': {
        get: {
          tags: ['文件夹管理'],
          summary: '文件夹列表',
          parameters: objectToQueryParams(FolderQuerySchema),
          responses: { 200: { description: '文件夹列表' } },
        },
        post: {
          tags: ['文件夹管理'],
          summary: '创建文件夹',
          requestBody: {
            required: true,
            content: { 'application/json': { schema: zodSchemaToOpenAPI(CreateFolderSchema) } },
          },
          responses: { 201: { description: '创建成功' } },
        },
      },
      '/manage/folders/{id}': {
        patch: {
          tags: ['文件夹管理'],
          summary: '更新文件夹',
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
          requestBody: {
            content: { 'application/json': { schema: zodSchemaToOpenAPI(UpdateFolderSchema) } },
          },
          responses: { 200: { description: '更新成功' } },
        },
      },
      '/manage/orders': {
        get: {
          tags: ['订单管理'],
          summary: '订单列表',
          responses: { 200: { description: '订单列表' } },
        },
        post: {
          tags: ['订单管理'],
          summary: '创建订单',
          requestBody: {
            required: true,
            content: { 'application/json': { schema: zodSchemaToOpenAPI(CreateAdminOrderSchema) } },
          },
          responses: { 201: { description: '创建成功' } },
        },
      },
      '/manage/orders/{id}': {
        patch: {
          tags: ['订单管理'],
          summary: '更新订单',
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
          requestBody: {
            content: { 'application/json': { schema: zodSchemaToOpenAPI(UpdateAdminOrderSchema) } },
          },
          responses: { 200: { description: '更新成功' } },
        },
      },
      '/manage/orders/{id}/status': {
        patch: {
          tags: ['订单管理'],
          summary: '更新订单状态',
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
          requestBody: {
            required: true,
            content: {
              'application/json': { schema: zodSchemaToOpenAPI(UpdateOrderStatusSchema) },
            },
          },
          responses: { 200: { description: '状态更新成功' } },
        },
      },
      '/manage/orders/{id}/comment': {
        post: {
          tags: ['订单管理'],
          summary: '添加订单评论',
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
          requestBody: {
            required: true,
            content: { 'application/json': { schema: zodSchemaToOpenAPI(AddOrderCommentSchema) } },
          },
          responses: { 200: { description: '评论添加成功' } },
        },
      },
      '/manage/orders/batch': {
        post: {
          tags: ['订单管理'],
          summary: '批量订单操作',
          requestBody: {
            required: true,
            content: { 'application/json': { schema: zodSchemaToOpenAPI(BatchCreateOrderSchema) } },
          },
          responses: { 200: { description: '批量操作完成' } },
        },
      },
      '/manage/products': {
        get: {
          tags: ['商品管理'],
          summary: '商品列表',
          responses: { 200: { description: '商品列表' } },
        },
        post: {
          tags: ['商品管理'],
          summary: '创建商品',
          requestBody: {
            required: true,
            content: { 'application/json': { schema: zodSchemaToOpenAPI(CreateProductSchema) } },
          },
          responses: { 201: { description: '创建成功' } },
        },
      },
      '/manage/products/{id}': {
        patch: {
          tags: ['商品管理'],
          summary: '更新商品',
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
          requestBody: {
            content: { 'application/json': { schema: zodSchemaToOpenAPI(UpdateProductSchema) } },
          },
          responses: { 200: { description: '更新成功' } },
        },
      },
      '/manage/products/{id}/status': {
        patch: {
          tags: ['商品管理'],
          summary: '更新商品状态',
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
          requestBody: {
            required: true,
            content: {
              'application/json': { schema: zodSchemaToOpenAPI(UpdateProductStatusSchema) },
            },
          },
          responses: { 200: { description: '状态更新成功' } },
        },
      },
      '/manage/user': {
        post: {
          tags: ['用户管理'],
          summary: '创建用户',
          requestBody: {
            required: true,
            content: { 'application/json': { schema: zodSchemaToOpenAPI(CreateUserSchema) } },
          },
          responses: { 201: { description: '创建成功' } },
        },
      },
      '/manage/user/{id}': {
        patch: {
          tags: ['用户管理'],
          summary: '更新用户',
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
          requestBody: {
            content: { 'application/json': { schema: zodSchemaToOpenAPI(UpdateUserSchema) } },
          },
          responses: { 200: { description: '更新成功' } },
        },
      },
    },
    components: {
      securitySchemes: {
        BearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
        ApiKeyAuth: {
          type: 'apiKey',
          in: 'header',
          name: 'X-API-Key',
        },
      },
    },
    security: [{ BearerAuth: [] }, { ApiKeyAuth: [] }],
  };
}

/**
 * 将 ZodObject 的可选字段转为 query parameters
 */
function objectToQueryParams(schema) {
  const shape = schema._def?.shape();
  if (!shape) return [];

  return Object.entries(shape).map(([key, value]) => {
    const isOpt = value._def?.typeName === 'ZodOptional' || value._def?.typeName === 'ZodDefault';
    const inner = isOpt && value._def.innerType ? value._def.innerType : value;
    const converted = zodSchemaToOpenAPI(inner);

    return {
      name: key,
      in: 'query',
      required: !isOpt,
      schema: converted,
    };
  });
}

// OpenAPI JSON 端点
app.get('/openapi.json', (c) => {
  return c.json(buildOpenAPISpec());
});

// Swagger UI 页面
app.get('/', (c) => {
  const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>KK-Image API 文档</title>
  <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css">
  <style>
    body { margin: 0; padding: 0; }
    .topbar { display: none; }
  </style>
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
  <script>
    SwaggerUIBundle({
      url: '/api/v1/api-docs/openapi.json',
      dom_id: '#swagger-ui',
      presets: [SwaggerUIBundle.presets.apis, SwaggerUIBundle.SwaggerUIStandalonePreset],
      layout: 'BaseLayout',
      deepLinking: true,
    });
  </script>
</body>
</html>`;

  return c.html(html);
});

export default app;
