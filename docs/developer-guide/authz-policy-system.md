# 授权策略系统（OPA/Rego）设计与开发标准

本文档定义 kk-life 当前授权系统的设计、开发流程和工程标准。目标是让权限逻辑在不同环境下行为一致、可测试、可演进。

## 0. 当前状态（2026-03-05）

- 已完成：授权运行时切换为 Workers 原生 Wasm 工件加载（`policy-artifact.wasm`）。
- 已完成：移除运行时 JS fallback，线上/本地统一走 OPA 决策路径（fail-closed）。
- 已完成：策略编译产物拆分为 wasm（二进制）+ metadata/data（js），降低策略产物耦合度。
- 已完成：单元测试已覆盖 Workers 路径与 Node 测试路径，不存在第二套权限规则实现。

## 1. 设计目标

- 单一真相源：权限规则由 `policy/` 统一定义，避免前后端分叉。
- 策略与实现解耦：规则逻辑、元数据、运行时加载分离。
- 默认安全：鉴权失败时默认拒绝（fail-closed）。
- 可验证：策略改动必须经过策略测试和一致性测试。
- 可开发：本地支持自动重编译策略，降低调试成本。

## 2. 目录与职责

| 路径                                                 | 职责                                |
| ---------------------------------------------------- | ----------------------------------- |
| `policy/authz.rego`                                  | 授权判定规则（allow/reason）        |
| `policy/metadata.json`                               | 角色、动作、动作标签元数据          |
| `policy/tests/*.rego`                                | 策略单测（OPA 原生测试）            |
| `scripts/policy/compile-opa.mjs`                     | 编译 Rego -> WASM + 生成运行时产物  |
| `scripts/policy/watch-opa.mjs`                       | 监听策略文件变更并自动重编译        |
| `functions/lib/authz/generated/policy-artifact.wasm` | 预编译 OPA-WASM 模块产物            |
| `functions/lib/authz/generated/policy-artifact.js`   | 运行时数据产物（metadata/data）     |
| `functions/lib/authz/wasm-loader.worker.js`          | Workers 运行时 Wasm module 加载桥接 |
| `functions/lib/authz/opa-engine.js`                  | OPA 评估引擎（OPA 单决策路径）      |
| `functions/lib/authz/index.js`                       | 鉴权输入构建与统一评估入口          |
| `functions/lib/hono/middleware/auth.js`              | 路由权限守卫调用入口                |

## 3. 核心架构

### 3.1 策略层（Rego）

`policy/authz.rego` 定义三类允许条件：

- `role_wildcard`：角色通配权限（例如 `admin:full`）
- `role_permission`：角色动作权限
- `direct_permission`：用户直授权限

输出统一为：

```json
{ "allow": true|false, "reason": "..." }
```

### 3.2 元数据层（JSON）

`policy/metadata.json` 维护：

- `roles`: 角色与默认权限集合
- `actions`: 系统动作全集（白名单）
- `actionLabels`: 动作展示文案

用途：

- 权限 API 输出（`/api/v1/permissions`）
- 用户权限校验（未知权限拦截）
- 测试一致性检查

### 3.3 运行时层（Functions）

运行时使用 Workers 原生 Wasm module binding 加载 `policy-artifact.wasm`，并注入 `policy-artifact.js` 的数据上下文。  
生产/开发请求路径统一走 OPA 评估，不再维护 JS 影子策略。

说明：单元测试在 Node 环境会从同一 wasm 工件加载并编译为 `WebAssembly.Module`，仅用于测试执行，不参与线上决策分叉。

## 4. 权限决策数据流

1. 路由声明 `requirePermission('x:y')`
2. `authMiddleware` 解析用户上下文（JWT/API Key）
3. `evaluateUserPermission` 构建标准输入：
   - `subject`：id/type/role/permissions
   - `action`：权限动作
   - `resource`：路径
   - `context`：HTTP method
4. `opa-engine` 执行策略评估并返回 `allow`
5. 中间件根据 `allow` 放行或返回 403

## 5. 开发指南

### 5.1 修改策略逻辑（`.rego`）

适用场景：修改允许/拒绝规则本身。

步骤：

1. 修改 `policy/authz.rego`
2. 增加/更新 `policy/tests/*.rego`
3. 执行 `pnpm authz:policy:test`
4. 执行 `pnpm authz:policy:build`
5. 重启 `wrangler/pages dev` 进程验证

### 5.2 修改角色权限映射（`.json`）

适用场景：新增动作、调整角色默认权限、更新动作标签。

步骤：

1. 修改 `policy/metadata.json`
2. 确保新增动作在 `actions` 中声明
3. 必要时更新路由的 `requirePermission(...)`
4. 执行测试和编译命令（同上）

### 5.3 开发期自动编译

推荐并行运行：

```bash
pnpm authz:policy:watch
```

该命令会监听 `policy/` 下 `.rego/.json` 变更并自动编译。  
如果 `wrangler` 进程已启动，仍需要重启以加载新产物。

### 5.4 本地联调标准命令

推荐使用项目脚本，确保使用仓库内 wrangler 版本：

```bash
pnpm dev:all
```

或静态产物模式：

```bash
pnpm build
pnpm start
```

注意：

- 不建议使用全局 `wrangler` 命令直接启动，避免版本差异导致行为不一致。
- 当你修改了策略（`.rego/.json`）后，即使运行了 watch/build，也必须重启 `wrangler pages dev` 才会加载新 wasm 工件。

## 6. 开发标准

### 6.1 动作命名规范

- 格式：`<domain>:<verb>`
- 示例：`products:manage`、`spaces:read`、`users:write`
- 禁止：模糊动作（如 `read`、`manage_all`）

### 6.2 角色规范

当前角色集合以 `metadata.json` 为准。新增角色必须满足：

- 在 `roles` 中定义标签与默认权限
- 与策略测试同步更新
- 路由与前端展示逻辑同步评估影响

### 6.3 路由守卫规范

- 所有受保护管理路由必须显式声明 `requirePermission(...)`
- 禁止依赖前端菜单可见性替代后端鉴权
- 禁止在业务 handler 内散写角色字符串判断替代统一引擎

### 6.5 审计声明规范

- 所有高风险写路由必须显式提供路由审计声明
- 审计声明应靠近路由定义，优先使用 `declareAuditRoutes(...)`
- 声明至少包含：`method`、`path`、`domain`、`action`、`severity`、`targetType`
- 新增高风险写路由时，除了权限守卫，还必须同时通过审计覆盖脚本

本地检查命令：

```bash
node scripts/qa/check-audit-route-coverage.mjs
```

该脚本会自动抽取写路由定义，并比对路由审计声明，而不是只依赖手工清单。

### 6.4 上下文规范

- 鉴权输入只使用标准字段：`subject/action/resource/context`
- 用户上下文必须先归一化（role/permissions/type）
- 不允许响应层伪造权限身份（例如无条件回退 admin）

## 7. 测试与质量门禁

### 7.1 必跑命令

```bash
pnpm authz:policy:test
pnpm authz:policy:build
pnpm test:unit:run
pnpm db:migrations:check-prefix
```

### 7.2 覆盖范围要求

- 策略单测：核心 allow/deny 分支
- 元数据一致性：角色权限与策略决策一致
- 路由动作一致性：声明动作必须存在于动作全集
- 运行时一致性：Workers 与测试环境均使用同一 wasm 工件

## 8. 变更清单（PR Checklist）

- 已更新 `policy/authz.rego` 或 `policy/metadata.json`（如适用）
- 已补充/更新策略测试
- 已执行策略测试与编译
- 已验证关键业务路由权限行为
- 已评估是否需要更新权限接口展示或前端权限文案

## 9. 常见问题与排障

### Q1: 登录成功但所有管理接口都 403

先检查：

1. `/api/v1/permissions/user` 是否返回空权限
2. 日志是否出现 OPA-WASM 初始化错误
3. 是否使用了过期/旧上下文 token

如果本地仍出现 Wasm 初始化错误，优先确认：

1. 已执行 `pnpm authz:policy:build` 生成最新 `policy-artifact.wasm`
2. 已重启 `wrangler/pages dev` 以加载新工件
3. 运行时日志未出现旧版 `POLICY_WASM_BASE64` 相关代码路径

### Q2: 修改了 `.rego` 但结果没变化

大概率是没重新编译产物或没重启服务：

```bash
pnpm authz:policy:build
# 然后重启 dev 进程
```

如果你使用的是全局 wrangler，请改为项目脚本（`pnpm dev:all` / `pnpm start`）复现，先排除本地 CLI 版本偏差。

### Q3: 需要下载 OPA 二进制吗

- 运行时鉴权不需要外部 OPA 二进制（使用项目产物）
- 策略测试/编译需要 OPA CLI，脚本会优先使用：
  - `OPA_BIN` 环境变量
  - `scripts/bin/opa(.exe)`
  - 系统 PATH 中的 `opa`

## 10. 结论

该系统的关键价值不在“使用 OPA”本身，而在“策略定义、运行时决策、接口契约、测试门禁”全部围绕同一套规则闭环。  
后续所有权限变更都应遵循本文档流程，避免策略分叉和隐性回归。

## 11. 前端请求契约（补充）

为保证 OPA 决策在前端不被“请求路径分叉”稀释，前端需遵守以下契约：

- 管理端/受保护请求仅通过 request core + adapter 流程发起
- 禁止在 `src/` 内直接 `fetch` 受保护端点（CI 守卫会阻断）
- 页面级与路由级拒绝态统一落到 `/admin/forbidden`
- 前端不得引入 `*` wildcard 的额外放权规则（仅认可 OPA 契约权限）

实现细节见：`docs/architecture/frontend-request-core.md`
