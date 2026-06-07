# Frontend Request Core（2026-03-06）

## 1. 目标

前端受保护请求统一走单一请求内核，避免重复实现和权限绕过：

- 管理端/受保护接口：统一通过 `requestAuth`
- 销售 token 场景：统一通过 `requestSales`
- 公共接口：统一通过 `requestPublic`

## 2. 核心模块

| 模块             | 位置                                    | 职责                                      |
| ---------------- | --------------------------------------- | ----------------------------------------- |
| HTTP Core        | `src/utils/http-core.js`                | 统一 `request(url, options)` 与错误标准化 |
| Auth Wrapper     | `src/composables/useAuth.js`            | 认证状态管理，`authFetch` 委托到 core     |
| Request Adapters | `src/composables/useRequestAdapters.js` | 按场景注入凭证（auth/public/sales）       |

## 3. 错误模型

`http-core` 对非 2xx 响应抛出标准错误对象：

- `error.status`：HTTP 状态码
- `error.message`：优先取 `data.error` / `data.message` / `statusText`
- `error.data`：响应 JSON（若可解析）

该模型被页面层、组合式函数和路由守卫统一消费。

## 4. 适配器模式

### 4.1 Auth Adapter

- 方法：`requestAuth(url, options)`
- 注入：`credentials: 'include'`
- 用途：`/api/manage/*`、`/api/v1/permissions*` 等受保护管理请求

### 4.2 Sales Adapter

- 方法：`requestSales(url, { token, ...options })`
- 注入：`Authorization: Bearer <token>`
- 用途：销售 token 页面请求（与管理端认证路径隔离）

### 4.3 Public Adapter

- 方法：`requestPublic(url, options)`
- 注入：无认证信息
- 用途：公开页面或无需凭证的请求

## 5. 权限一致性

- 前端不再将 `'*'` 视为强制权限
- 强制状态流转权限仅允许 `admin:full`
- 路由层与页面层拒绝入口统一到 `/admin/forbidden`

## 6. 回归守卫

- 本地/CI 规则：`scripts/qa/check-direct-protected-fetch.mjs`
- 目标：阻断 `src/` 内对受保护端点的直接 `fetch`
- 允许例外：`src/composables/useAuth.js`（底层认证入口）

## 7. 审计命令

```bash
# 拒绝场景：应稳定进入拒绝态
AUDIT_SCENARIO=deny node scripts/qa/admin-headless-audit.mjs

# 放行场景：不应出现误拒绝（/admin/forbidden 除外）
AUDIT_SCENARIO=allow node scripts/qa/admin-headless-audit.mjs
```
