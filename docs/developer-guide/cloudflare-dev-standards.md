# Cloudflare 平台开发规范 (Standards & Best Practices)

**Last Updated**: 2025-12-28
**Scope**: 适用于基于 Cloudflare Pages Functions, D1, R2 的应用开发。

本文档定义了在 kk-life 项目中遵循的 Cloudflare 开发标准。

## 1. 架构与目录结构

### 1.1 Pages Functions 路由
*   **文件路由**: 使用 `/functions` 目录进行基于文件的路由。
    *   `functions/api/v1/users.js` -> `/api/v1/users`
*   **中间件**: 使用 `_middleware.js` 处理通用逻辑（鉴权、日志、CORS）。
    *   层级化中间件：根目录的 `_middleware.js` 全局生效，子目录的 `_middleware.js` 仅对该子目录生效。

### 1.2 上下文传递 (`context`)
*   **禁止**: 避免直接挂载属性到 `context` 根对象上（如 `context.user`），这在某些运行时不可靠。
*   **强制**: 使用 `context.data` 传递请求生命周期内的数据。
    *   Example: `context.data.user = userPayload;`

## 2. 数据库规范 (D1)

### 2.1 查询安全
*   **禁止**: 严禁使用字符串拼接构建 SQL 语句。
*   **强制**: 必须使用 Parameter Binding (参数绑定)。
    ```javascript
    // ❌ 错误
    await env.DB.prepare(`SELECT * FROM users WHERE id = '${id}'`).run(); 
    
    // ✅ 正确
    await env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(id).run();
    ```

### 2.2 批量操作 (SOTA)
*   **强制**: 在循环插入或更新数据时，**必须**使用 D1 Batch API。
    ```javascript
    // ✅ SOTA: 使用 Batch 减少网络往返
    const statements = files.map(f => env.DB.prepare('INSERT...').bind(...));
    await env.DB.batch(statements);
    ```

### 2.3 错误处理
*   **UNIQUE 约束**: 对于可能重复插入的场景（如忽略重复文件），推荐使用 SQL 级的 `INSERT OR IGNORE`，而不是在代码中 `try-catch`，性能更高。

## 3. 对象存储规范 (R2)

### 3.1 访问策略
*   **私有读写**: 默认情况下，R2 Bucket 不应向公网公开。
*   **公开访问**: 如果需要公开访问（如图床），应绑定 Custom Domain 或在 Cloudflare Settings 中开启 Public Access，并配置适当的 Cache Rules。

### 3.2 性能优化
*   **Cache API**: 在 Pages Functions 中读取 R2 对象时，可配合 Cache API 使用，减少对 R2 的 API 调用成本（Class B operations）。

## 4. 安全规范 (Security)

### 4.1 密钥管理
*   **禁止**: 代码中出现任何 Secret (API Keys, Tokens, Passwords)。
*   **强制**: 使用环境变量 (`env`)。本地开发使用 `.dev.vars`，生产环境在 Dashboard 设置。

### 4.2 响应头 (Headers)
*   **CORS**: API 必须配置正确的 CORS 头。建议在 `functions/_middleware.js` 中统一处理 `OPTIONS` 请求。
*   **Security Headers**: 生产环境应包含 `Strict-Transport-Security`, `X-Content-Type-Options` 等安全头。

## 5. 开发流程 (Workflow)

### 5.1 数据迁移
*   所有数据库变更必须通过 `migrations/` 目录下的 `.sql` 文件管理。
*   禁止手动修改生产数据库结构。

### 5.2 依赖管理
*   Pages Functions 运行在 Node.js 兼容模式下 (`compatibility_flags = ["nodejs_compat"]`)。
*   尽量减少庞大的 npm 包依赖，优先使用 Web Standards API (`fetch`, `Request`, `Response`, `URL`).

## 6. 参考资源
*   [Cloudflare D1 Docs](https://developers.cloudflare.com/d1/)
*   [Cloudflare Pages Functions Routing](https://developers.cloudflare.com/pages/functions/routing/)
*   [Wrangler CLI Commands](https://developers.cloudflare.com/workers/wrangler/commands/)
