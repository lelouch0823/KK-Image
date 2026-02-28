# Hono API 路由设计文档

## 1. 模块概述

### 1.1 整体架构

KK-Image 项目采用 **Hono** 框架构建 RESTful API，运行在 Cloudflare Workers/Pages 环境中。整体架构遵循洋葱模型的中间件设计模式。

```
Client Request
      ↓
┌─────────────────────────────────────────────────────────────┐
│                    Cloudflare Edge                           │
├─────────────────────────────────────────────────────────────┤
│  Global Middleware Stack (洋葱模型，从外到内执行)             │
│  ├── Error Handler (app.onError)                            │
│  ├── Logger (hono/logger)                                   │
│  ├── CORS (hono/cors)                                       │
│  ├── Security Headers (hono/secure-headers)                 │
│  └── Rate Limit (/api/*)                                    │
├─────────────────────────────────────────────────────────────┤
│  Authentication Middleware                                   │
│  ├── /api/v1/* → authMiddleware                             │
│  ├── /api/manage/* → authMiddleware                         │
│  └── /api/sales/* → authMiddleware + salesAuthMiddleware    │
├─────────────────────────────────────────────────────────────┤
│  Route Handlers                                              │
└─────────────────────────────────────────────────────────────┘
      ↓
   Response
```

### 1.2 目录结构

```
functions/lib/hono/
├── app.js                    # 主应用入口，路由注册
├── errors.js                 # 自定义错误类
├── _shared/                  # 共享工具
│   ├── auth-helpers.js       # 认证辅助函数
│   └── route-helpers.js      # 路由辅助函数
├── middleware/               # 中间件
│   ├── auth.js               # JWT 认证中间件
│   ├── sales-auth.js         # 销售人员认证中间件
│   ├── errorHandler.js       # 全局错误处理
│   ├── rateLimit.js          # 限流中间件
│   └── cache.js              # 边缘缓存中间件
├── schemas/                  # Zod 验证 Schema
│   ├── file.js
│   ├── folder.js
│   └── sales.js
└── routes/                   # 路由模块
    ├── v1/                   # V1 API (公开/标准)
    ├── manage/               # 管理后台 API
    └── sales/                # 销售端 API
```

---

## 2. 路由结构

### 2.1 API 路由树

```
/api
├── /v1                                    # V1 API (标准 RESTful)
│   ├── /auth                              # 认证路由
│   │   ├── POST /login                    # 用户登录
│   │   ├── POST /logout                   # 登出
│   │   └── GET /me                        # 获取当前用户
│   ├── /files                             # 文件 CRUD
│   ├── /folders                           # 文件夹 CRUD
│   ├── /users                             # 用户管理
│   ├── /permissions                       # 权限管理
│   └── /webhooks                          # Webhook 管理
│
├── /manage                                # 管理后台 API
│   ├── /folders                           # 文件夹管理
│   ├── /files                             # 文件管理
│   ├── /spaces                            # 空间管理
│   ├── /orders                            # 订单管理
│   ├── /products                          # 产品管理
│   ├── /customers                         # 客户管理
│   ├── /salespersons                      # 销售人员管理
│   ├── /notifications                     # 通知管理
│   ├── /dashboard                         # 仪表盘
│   ├── /stats                             # 统计
│   ├── /upload                            # 上传
│   ├── /search                            # 全文搜索
│   ├── /trash                              # 回收站
│   ├── /settings                          # 设置
│   ├── /audit-logs                        # 审计日志
│   ├── /ai                                # AI 功能
│   ├── /goods-overview                    # 订货总览
│   └── /purchase-orders                   # 采购单管理
│
└── /sales                                 # 销售端 API
    ├── POST /login                        # 登录
    ├── POST /wechat-login                 # 微信登录
    └── /:token                            # Token 认证路由
        ├── POST /auth                     # Token 登录
        ├── GET /stats                     # 个人统计
        └── /orders                        # 订单
```

---

## 3. 中间件系统

### 3.1 中间件执行顺序

```javascript
// 洋葱模型，从外到内执行
app.use('*', logger());                    // 1. 日志记录
app.use('*', cors({...}));                 // 2. CORS 处理
app.use('*', secureHeaders());             // 3. 安全头
app.use('/api/*', rateLimitMiddleware);    // 4. 限流
app.use('/api/v1/*', authMiddleware);      // 5. V1 认证
app.use('/api/manage/*', authMiddleware);  // 5. 管理端认证
```

### 3.2 认证中间件

**Token 获取优先级**:
1. **Authorization Header**: `Bearer <token>`
2. **Cookie**: `admin_auth=<token>`
3. **API Key Header**: `X-API-Key: <key>`

**权限检查中间件工厂**:
```javascript
export function requirePermission(permission) {
  return async (c, next) => {
    const user = c.get('user');
    if (user.type === 'admin' || user.permissions?.includes('admin:full')) {
      return next();
    }
    if (hasPermission(user.role, permission)) {
      return next();
    }
    return c.json({ success: false, error: 'Forbidden' }, 403);
  };
}
```

### 3.3 限流中间件

```javascript
// 默认配置
const windowMs = 60000;     // 1 分钟窗口
const maxRequests = 100;    // 每窗口最大请求数

// 登录锁定机制
const LOGIN_LOCKOUT_CONFIG = {
  maxAttempts: 5,           // 最大失败次数
  lockoutDuration: 15 * 60, // 锁定时间（秒）
};
```

### 3.4 缓存中间件

```javascript
export function withCache(ttlSeconds = 60) {
  return async (c, next) => {
    // ETag 条件请求
    if (ifNoneMatch === cachedEtag) {
      return new Response(null, { status: 304 });
    }
    response.headers.set('Cache-Control', `public, max-age=${ttlSeconds}`);
  };
}
```

---

## 4. 请求/响应模式

### 4.1 数据验证 (Zod Schema)

```javascript
export const FileQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  sort: z.enum(['created_at', 'name', 'size']).default('created_at'),
  order: z.enum(['asc', 'desc']).default('desc'),
  search: z.string().max(100).optional(),
});
```

### 4.2 响应格式

```javascript
// 成功响应
return c.json({
  success: true,
  data: { ... },
  pagination: { page, limit, total, totalPages }
});

// 错误响应
return c.json({
  success: false,
  error: 'Resource not found',
  code: 'NOT_FOUND'
}, 404);
```

### 4.3 分页模式

```javascript
// 请求参数
GET /api/v1/files?page=2&limit=50

// 辅助函数
export function parsePagination(c, { page = 1, limit = 20 } = {}) {
  const page = Math.max(1, parseInt(c.req.query('page') || String(page), 10));
  const limit = Math.min(100, Math.max(1, parseInt(c.req.query('limit') || String(limit), 10)));
  return { page, limit, offset: (page - 1) * limit };
}
```

---

## 5. 错误处理

### 5.1 自定义错误类

```javascript
export class AppError extends Error {
  constructor(message, statusCode = 500, code = 'INTERNAL_ERROR') {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'Resource not found') {
    super(message, 404, 'NOT_FOUND');
  }
}
```

### 5.2 错误码表

| HTTP 状态码 | 错误码 | 说明 |
|------------|--------|------|
| 400 | BAD_REQUEST | 请求参数无效 |
| 401 | UNAUTHORIZED | 未认证 |
| 403 | FORBIDDEN | 权限不足 |
| 404 | NOT_FOUND | 资源不存在 |
| 409 | CONFLICT | 资源冲突 |
| 429 | RATE_LIMIT | 请求频率超限 |
| 500 | INTERNAL_ERROR | 服务器内部错误 |

---

## 6. API 设计模式

### 6.1 RESTful 规范

```
GET    /api/v1/files        # 列表
POST   /api/v1/files        # 创建
GET    /api/v1/files/:id    # 详情
PUT    /api/v1/files/:id    # 完整更新
PATCH  /api/v1/files/:id    # 部分更新
DELETE /api/v1/files/:id    # 删除
```

### 6.2 批量操作模式

```javascript
// 批量删除
POST /api/v1/files/batch/delete
Body: { "ids": ["id1", "id2", "id3"] }

// 批量移动
POST /api/v1/files/batch/move
Body: { "ids": ["id1", "id2"], "targetFolderId": "folder123" }
```

### 6.3 异步后台任务

```javascript
// Webhook 触发 (非阻塞)
c.executionCtx.waitUntil(
  triggerWebhook(env, 'file.uploaded', { file, user })
);

// 审计日志记录 (非阻塞)
c.executionCtx.waitUntil(
  logAudit(env.DB, { userId, action: 'files:delete', targetId })
);
```

---

## 7. 最佳实践

### 7.1 安全最佳实践

1. **SQL 注入防护**: 使用参数化查询 + 列名白名单
2. **认证多重验证**: JWT + API Key 双重支持
3. **登录保护**: 失败锁定 + 滑动窗口限流
4. **权限分离**: RBAC 角色 + 细粒度权限

### 7.2 性能优化建议

1. **边缘缓存**: 对只读 GET 请求启用 Cache API
2. **并行查询**: 使用 `Promise.all` 减少等待时间
3. **异步操作**: Webhook、审计日志使用 `waitUntil` 非阻塞执行
4. **分页限制**: 最大 limit 100，防止大量数据查询

### 7.3 代码组织建议

1. **Repository 模式**: 数据访问逻辑封装在 Repository 层
2. **Schema 分离**: 验证逻辑独立于路由处理
3. **中间件复用**: 认证、权限、缓存通过中间件实现
4. **错误统一**: 使用自定义 Error 类 + 全局错误处理
