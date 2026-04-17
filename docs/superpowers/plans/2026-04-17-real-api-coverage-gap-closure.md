# Real API Coverage Gap Closure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 补齐当前主项目仍缺失的关键真实 API 与跨模块业务联动测试，确保客户、销售员、销售文件、统计看板、搜索/标签这些核心业务域不再只停留在单元或契约层验证。

**Architecture:** 以现有 `test/*-real-api.test.js` 风格为基线，优先补“真实 runtime + 真路由 + 真 DB + 真 outbox/cache/projection”的端到端业务链，再把高价值新文件接入 root `test:real-api` / `test:real-api:full-chain`。所有新增测试遵守 TDD：先写会失败的真实链路，再做最小实现修复，最后扩大到主脚本验证。

**Tech Stack:** Cloudflare Pages Functions, Hono, D1, Vitest, local `wrangler pages dev`, real API harness in `test/utils/*`

---

## Gap Inventory

### P0: Customers Real API

- 现状:
  - [`functions/lib/hono/routes/manage/customers.js`](/home/bjw/Code/KK-Image/functions/lib/hono/routes/manage/customers.js) 只有路由实现，没有真实 API 覆盖。
- 风险:
  - 客户 CRUD、搜索、删除保护、客户事件的 cache/audit/outbox 联动没有被真实 runtime 证明。
- 目标:
  - 新增 `test/customers-real-api.test.js`
  - 覆盖 create/list/detail/update/delete
  - 覆盖 `search` 与分页
  - 覆盖“存在关联订单时禁止删除”
  - 覆盖客户事件后列表缓存刷新

### P0: Salespersons + Sales Auth/Profile Real API

- 现状:
  - 现有测试只把销售员作为夹具创建出来，没有真实验证销售员管理生命周期。
  - [`functions/lib/hono/routes/manage/salespersons.js`](/home/bjw/Code/KK-Image/functions/lib/hono/routes/manage/salespersons.js)
  - [`functions/lib/hono/routes/sales/auth.js`](/home/bjw/Code/KK-Image/functions/lib/hono/routes/sales/auth.js)
  - [`functions/lib/hono/routes/sales/profile.js`](/home/bjw/Code/KK-Image/functions/lib/hono/routes/sales/profile.js)
- 风险:
  - token reset、停用、旧 token 失效、新 token 生效、profile/stats 响应结构与缓存行为都缺少真实证明。
- 目标:
  - 新增 `test/salespersons-real-api.test.js`
  - 覆盖管理端 list/detail/create/update/disable/delete/reset-token
  - 覆盖“有订单时禁止删除”
  - 覆盖 sales auth 登录
  - 覆盖 `/api/sales/:token/profile/auth`
  - 覆盖 `/api/sales/:token/profile/stats` 在订单变化后的聚合结果

### P1: Sales File Upload Real API

- 现状:
  - [`functions/lib/hono/routes/sales/files.js`](/home/bjw/Code/KK-Image/functions/lib/hono/routes/sales/files.js) 没有真实 API 测试。
- 风险:
  - 销售上传附件到订单目录、权限约束、审计与 outbox 事件可能只在实现层自洽。
- 目标:
  - 新增 `test/sales-files-real-api.test.js`
  - 覆盖 sales upload 到无订单场景
  - 覆盖带 `orderId` 上传到本人订单
  - 覆盖上传到非本人订单返回 403
  - 覆盖文件在管理端订单详情/文件列表可见
  - 覆盖 `file_uploaded`/相关 outbox 与 webhook 或 cache fan-out

### P1: Dashboard/Stats Projection Real API

- 现状:
  - [`functions/lib/hono/routes/manage/dashboard.js`](/home/bjw/Code/KK-Image/functions/lib/hono/routes/manage/dashboard.js)
  - [`functions/lib/hono/routes/manage/stats.js`](/home/bjw/Code/KK-Image/functions/lib/hono/routes/manage/stats.js)
  - [`functions/lib/hono/routes/sales/profile.js`](/home/bjw/Code/KK-Image/functions/lib/hono/routes/sales/profile.js)
  - 当前只有间接覆盖，没有直接真实 API 断言。
- 风险:
  - 读模型刷新的真实延迟、缓存失效、聚合字段正确性没有被单独锁住。
- 目标:
  - 新增 `test/dashboard-stats-real-api.test.js`
  - 覆盖 `manage/dashboard/overview`
  - 覆盖 `manage/stats`
  - 覆盖 `manage/stats/uploads`
  - 覆盖业务事件后投影刷新
  - 覆盖 sales profile stats 对应销售员维度聚合

### P2: Search/Tags Real API

- 现状:
  - [`test/search-tags.test.js`](/home/bjw/Code/KK-Image/test/search-tags.test.js) 仍是 app/request 级别，不是 Cloudflare local runtime。
  - [`functions/lib/hono/routes/manage/search.js`](/home/bjw/Code/KK-Image/functions/lib/hono/routes/manage/search.js)
  - [`functions/lib/hono/routes/manage/tags.js`](/home/bjw/Code/KK-Image/functions/lib/hono/routes/manage/tags.js)
- 风险:
  - FTS、真实 DB 数据、标签分配/解除与缓存失效未经过真实链路验证。
- 目标:
  - 新增 `test/search-tags-real-api.test.js`
  - 覆盖 tag create/list/assign/unassign
  - 覆盖基于真实文件/文件夹数据的 search
  - 覆盖标签变更后缓存刷新

## Recommended Order

1. Customers
2. Salespersons + sales auth/profile
3. Sales files
4. Dashboard/stats projections
5. Search/tags

原因:
- 前两项是主数据和身份链路，影响后续大量业务夹具构建
- 第三项补齐销售入口的真实文件面
- 第四项验证聚合读模型
- 第五项属于检索辅助域，价值高但不阻塞交易主链

## File Map

### New Tests

- Create: `test/customers-real-api.test.js`
- Create: `test/salespersons-real-api.test.js`
- Create: `test/sales-files-real-api.test.js`
- Create: `test/dashboard-stats-real-api.test.js`
- Create: `test/search-tags-real-api.test.js`

### Likely Shared Helper Touchpoints

- Modify: `test/utils/manage-products-real-api.js`
- Modify: `test/utils/sales-real-api.js`
- Optionally create: `test/utils/customers-real-api.js`
- Optionally create: `test/utils/stats-real-api.js`

### Root Script Registration

- Modify: [`package.json`](/home/bjw/Code/KK-Image/package.json)

## Phase Plan

### Phase 1: Customers Real API

**Files:**
- Create: `test/customers-real-api.test.js`
- Modify: `package.json`

- [ ] Step 1: 写客户真实 API 红测
- [ ] Step 2: 单跑新文件，确认当前缺口是真实缺口或确认现状已绿
- [ ] Step 3: 如有缺口，最小修复生产代码
- [ ] Step 4: 重新单跑 `test/customers-real-api.test.js`
- [ ] Step 5: 把新文件接入 `test:real-api`

Run:
- `BASE_URL=http://127.0.0.1:8080 RUN_REAL_API_TESTS=1 node node_modules/vitest/vitest.mjs --maxWorkers 1 test/customers-real-api.test.js`

Done when:
- 客户 CRUD、搜索、分页、删前保护全部有真实 API 断言
- 新文件已接入主脚本

### Phase 2: Salespersons + Sales Auth/Profile

**Files:**
- Create: `test/salespersons-real-api.test.js`
- Modify: `package.json`
- Optionally modify: `test/utils/sales-real-api.js`

- [ ] Step 1: 写销售员管理与 token reset 红测
- [ ] Step 2: 写 sales auth/profile/stats 红测
- [ ] Step 3: 单跑并确认失败原因
- [ ] Step 4: 做最小修复
- [ ] Step 5: 重新单跑并接入主脚本

Run:
- `BASE_URL=http://127.0.0.1:8080 RUN_REAL_API_TESTS=1 node node_modules/vitest/vitest.mjs --maxWorkers 1 test/salespersons-real-api.test.js`

Done when:
- 旧 token 失效 / 新 token 生效被真实验证
- profile auth/stats 对真实订单数据聚合正确

### Phase 3: Sales Files Real API

**Files:**
- Create: `test/sales-files-real-api.test.js`
- Modify: `package.json`

- [ ] Step 1: 写销售上传到本人订单的红测
- [ ] Step 2: 写上传到他人订单 403 红测
- [ ] Step 3: 写管理端可见性/outbox 联动断言
- [ ] Step 4: 单跑、修复、重跑
- [ ] Step 5: 接入主脚本

Run:
- `BASE_URL=http://127.0.0.1:8080 RUN_REAL_API_TESTS=1 node node_modules/vitest/vitest.mjs --maxWorkers 1 test/sales-files-real-api.test.js`

Done when:
- 销售上传真实链路被验证到文件落库、目录归属、权限限制、联动事件

### Phase 4: Dashboard/Stats Projection Real API

**Files:**
- Create: `test/dashboard-stats-real-api.test.js`
- Modify: `package.json`

- [ ] Step 1: 设计最小事件链驱动统计变化
- [ ] Step 2: 写 dashboard/stats/profile stats 红测
- [ ] Step 3: 单跑验证缓存和投影刷新
- [ ] Step 4: 如需修复，最小修复 projection/cache
- [ ] Step 5: 接入主脚本

Run:
- `BASE_URL=http://127.0.0.1:8080 RUN_REAL_API_TESTS=1 node node_modules/vitest/vitest.mjs --maxWorkers 1 test/dashboard-stats-real-api.test.js`

Done when:
- 事件发生后，dashboard/stats/profile stats 在真实 API 上收敛到预期值

### Phase 5: Search/Tags Real API

**Files:**
- Create: `test/search-tags-real-api.test.js`
- Modify: `package.json`

- [ ] Step 1: 写 tag create/list/assign/unassign 红测
- [ ] Step 2: 写 search 对真实文件数据的命中红测
- [ ] Step 3: 写 tag 变更后缓存/列表收敛断言
- [ ] Step 4: 单跑、修复、重跑
- [ ] Step 5: 接入主脚本

Run:
- `BASE_URL=http://127.0.0.1:8080 RUN_REAL_API_TESTS=1 node node_modules/vitest/vitest.mjs --maxWorkers 1 test/search-tags-real-api.test.js`

Done when:
- 标签与搜索链路不再只靠 mock/app.request 级测试

## Final Verification

- [ ] `pnpm build`
- [ ] `pnpm test`
- [ ] `pnpm test:real-api`
- [ ] `pnpm test:real-api:full-chain`
- [ ] `pnpm lint`

## Success Criteria

- `test:real-api` 覆盖面从当前 21 files 扩展到至少 26 files
- 客户、销售员、销售文件、统计看板、搜索/标签五个域都有真实 API 文件
- 每个新增文件至少覆盖一个跨模块联动，而不是只测单接口
- 新增测试全部纳入主脚本，不留“单跑才会发现”的孤立用例
