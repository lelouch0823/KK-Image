---
trigger: always_on
---

# Project Context: KK-Image (Telegraph-Image-PRO)

这是一个基于 Cloudflare Pages 全栈架构的高性能图床/文件存储系统。

## 1. 核心原则 (Core Principals)
- **语言**：永远使用 **中文** 进行交流和注释。
- **SOTA (State of the Art)**：始终采用当前技术栈的最佳实践和最新特性。拒绝过时代码。
- **代码质量**：代码必须模块化、可读、健壮且类型安全（尽可能）。
- **优先复用**：编码时优先利用项目内已定义的公共工具类 (`src/utils`, `functions/api/utils`) 和公共 UI 组件。

## 2. 技术栈规范 (Tech Stack)

### 前端 (Frontend)
- **框架**：Vue 3 + Vite (`<script setup>` 语法)。
- **样式**：Tailwind CSS v4 (使用 `@tailwindcss/vite` 插件)。禁止手写原生 CSS，除非 Tailwind 无法实现。
- **状态管理**：Vue Composition API (`ref`, `reactive`, `computed`) + Composables (`src/composables`).
- **路由**：SPA 路由，页面位于 `src/pages/*.html`，构建时 flatten 到根目录。
- **图标**：直接使用 SVG 图标（Heroicons 风格），避免引入庞大的图标库。

### 后端 (Backend / Cloudflare Functions)
- **运行环境**：Cloudflare Workers (Node.js compat enabled).
- **数据库**：Cloudflare D1 (SQLite)。
    - **SOTA**: 批量插入/更新操作 **必须** 使用 `env.DB.batch()`.
    - **Query**: 优先使用 `prepare().bind().run()/all()/first()`. 禁止直接拼接 SQL 字符串（防止 SQL 注入）。
- **对象存储**：Cloudflare R2。使用 `env.R2_BUCKET` 绑定。
- **键值存储**：Cloudflare KV。使用 `env.KV` 绑定。
- **API 路径**：基于文件的路由 (`functions/api/v1/...` -> `/api/v1/...`).

## 3. 编码行为准则 (Behavior Constraints)

### A. 修改代码前
- **必须** 先阅读相关文件，理解上下文。不要盲目修改。
- 检查是否存在现有的工具函数（如 `getFileUrl`, `generateId`, `useToast`）。

### B. 安全性 (Security)
- **严禁硬编码**：永远不要在代码中硬编码密码、Token、Secret 或 API Key。必须使用环境变量 (`env.KEY`) 或 `context.env`.
- **权限验证**：后端 API 必须校验用户权限。使用 `functions/utils/middleware.js` 提供的 context。

### C. 错误处理 (Error Handling)
- 前端：捕获 API 错误并使用 `useToast` (`addToast`) 显示友好的中文提示。
- 后端：使用 `functions/api/utils/response.js` 中的 `error()` 辅助函数返回标准 JSON 错误格式。

### D. 文件结构 (File Structure)
- `src/components/`: 可复用的 Vue 组件。
- `src/composables/`: 组合式函数 (Logic reuse)。
- `functions/api/`: 后端 API 端点。
- `functions/utils/`: 后端通用工具 (Middleware, ID 生成, 响应封装)。

## 4. 特殊业务逻辑 (Specific Business Logic)
- **Token**：Upload Token 用于 API 鉴权，JWT 用于管理后台鉴权。
- **图片处理**：后端不处理图片压缩（由 R2/CDN 或前端处理），但支持 ModerateContent 审查。
- **Shared Spaces**：共享空间逻辑在 `functions/api/manage/spaces` 和 `src/components/Space*.vue`.

遵循以上规则，确保代码的高效、安全与一致性。
