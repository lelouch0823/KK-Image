# Audit Module Remediation Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 修复审计模块的 3 个已确认问题：CSV 公式注入、审计上下文可伪造、审计日志读取行为无留痕。

**Architecture:** 采用“先护栏、后实现、再回归”的小步快跑方式。先为每个问题补一个最小失败测试，再做最小实现；可信化改动集中在共享审计 helper，避免把 header 过滤逻辑散落到各个路由；读取留痕通过显式审计 `GET /api/manage/audit-logs` 和 `GET /api/manage/audit-logs/actions` 完成，保持语义清晰。

**Tech Stack:** Hono, Vitest, Cloudflare D1, JavaScript (ESM)

---

### Task 1: 为审计导出补 CSV 注入回归测试

**Files:**
- Modify: `functions/lib/hono/routes/manage/__tests__/audit-logs-routes.test.js`

**Step 1: Write the failing test**

新增一个导出测试，构造如下审计行：

```js
{
  actor_name: '=cmd|calc',
  target_label: '+SUM(1,2)',
  summary: '@danger'
}
```

断言 CSV 响应体中的这些字段不会以 `=`, `+`, `-`, `@` 原样开头。

**Step 2: Run test to verify it fails**

Run: `node node_modules/vitest/vitest.mjs functions/lib/hono/routes/manage/__tests__/audit-logs-routes.test.js`

Expected: FAIL，失败点是导出的 CSV 仍包含危险前缀。

**Step 3: Write minimal implementation**

在 `functions/lib/hono/routes/manage/audit-logs.js` 中为 CSV 单元格增加公式注入防护：

- 新增 `sanitizeCsvCell()` 辅助函数
- 对字符串首字符为 `=`, `+`, `-`, `@` 的值前置单引号
- 保留现有双引号转义逻辑

**Step 4: Run test to verify it passes**

Run: `node node_modules/vitest/vitest.mjs functions/lib/hono/routes/manage/__tests__/audit-logs-routes.test.js`

Expected: PASS

**Step 5: Commit**

```bash
git add functions/lib/hono/routes/manage/audit-logs.js functions/lib/hono/routes/manage/__tests__/audit-logs-routes.test.js
git commit -m "fix(audit): harden csv export cells"
```

### Task 2: 为审计上下文可信化补共享 helper 测试

**Files:**
- Modify: `functions/lib/hono/_shared/__tests__/auth-helpers.audit.test.js`
- Modify: `functions/lib/hono/_shared/__tests__/audit-runtime-test-utils.js` if needed
- Modify: `functions/lib/hono/_shared/audit-helpers.js`

**Step 1: Write the failing test**

新增共享 helper 测试，覆盖以下行为：

```js
expect(getRequestAuditContext(mockContext).source_app).toBe('admin-web');
expect(getRequestAuditContext(mockContext).ip_address).toBe('203.0.113.1');
expect(getRequestAuditContext(mockContext).request_id).toBe('cf-ray-1');
expect(getRequestAuditContext(mockContext).trace_id).toBe(null);
```

其中请求头包含伪造的：

- `X-Source-App: evil-client`
- `X-Forwarded-For: 1.1.1.1, 2.2.2.2`
- `X-Request-Id: forged-id`
- `X-Trace-Id: forged-trace`

同时提供受信任来源：

- `CF-Connecting-IP: 203.0.113.1`
- `CF-Ray: cf-ray-1`
- `user.type = admin`

断言 helper 优先使用受信任上下文，而不是可伪造头。

**Step 2: Run test to verify it fails**

Run: `node node_modules/vitest/vitest.mjs functions/lib/hono/_shared/__tests__/auth-helpers.audit.test.js`

Expected: FAIL，失败点是当前实现会接受 `X-Source-App` / `X-Request-Id` / `X-Trace-Id`。

**Step 3: Write minimal implementation**

在 `functions/lib/hono/_shared/audit-helpers.js` 中调整：

- `source_app` 仅由已认证用户类型或内部显式参数推断，不再信任 `X-Source-App`
- `ip_address` 仅优先取 `CF-Connecting-IP`，无该值时降级为 `unknown`
- `request_id` 仅取 `CF-Ray`
- `trace_id` 默认 `null`，只允许后续内部代码显式传入

保持 `buildRequestAuditEvent()` 的显式参数覆盖能力，避免破坏内部调用方。

**Step 4: Run test to verify it passes**

Run: `node node_modules/vitest/vitest.mjs functions/lib/hono/_shared/__tests__/auth-helpers.audit.test.js`

Expected: PASS

**Step 5: Commit**

```bash
git add functions/lib/hono/_shared/audit-helpers.js functions/lib/hono/_shared/__tests__/auth-helpers.audit.test.js
git commit -m "fix(audit): trust only server-derived request context"
```

### Task 3: 为审计读取留痕补路由测试

**Files:**
- Modify: `functions/lib/hono/routes/manage/__tests__/audit-logs-routes.test.js`
- Modify: `functions/lib/hono/routes/manage/audit-logs.js`

**Step 1: Write the failing test**

新增两个测试：

1. `GET /api/manage/audit-logs` 成功返回列表时，会调用 `scheduleAuditEvent(...)`
2. `GET /api/manage/audit-logs/actions` 成功返回动作列表时，会调用 `scheduleAuditEvent(...)`

断言事件至少包含：

```js
{
  action: 'audit.read',
  domain: 'audit-logs',
  result: 'success'
}
```

并带上查询过滤条件、分页或动作总数等最小元数据。

**Step 2: Run test to verify it fails**

Run: `node node_modules/vitest/vitest.mjs functions/lib/hono/routes/manage/__tests__/audit-logs-routes.test.js`

Expected: FAIL，失败点是当前列表/动作接口不会记录读取审计事件。

**Step 3: Write minimal implementation**

在 `functions/lib/hono/routes/manage/audit-logs.js` 中：

- 列表接口成功返回前调用 `scheduleAuditEvent(c, ...)`
- 动作接口成功返回前调用 `scheduleAuditEvent(c, ...)`
- 建议动作名：
  - 列表：`audit.read`
  - 动作枚举：`audit.actions.read`
- `targetType` 统一使用 `audit_log`
- `severity` 使用 `normal`
- `metadata` 记录分页参数、过滤条件、返回条数

**Step 4: Run test to verify it passes**

Run: `node node_modules/vitest/vitest.mjs functions/lib/hono/routes/manage/__tests__/audit-logs-routes.test.js`

Expected: PASS

**Step 5: Commit**

```bash
git add functions/lib/hono/routes/manage/audit-logs.js functions/lib/hono/routes/manage/__tests__/audit-logs-routes.test.js
git commit -m "feat(audit): record audit log reads"
```

### Task 4: 跑审计相关回归

**Files:**
- No code changes

**Step 1: Run focused tests**

Run:

```bash
node node_modules/vitest/vitest.mjs functions/lib/hono/routes/manage/__tests__/audit-logs-routes.test.js functions/lib/hono/_shared/__tests__/auth-helpers.audit.test.js
```

Expected: PASS

**Step 2: Run audit suite**

Run: `npm run test:audit`

Expected: PASS with 0 failed files / 0 failed tests

**Step 3: Inspect diff**

Run: `git diff -- functions/lib/hono/_shared/audit-helpers.js functions/lib/hono/routes/manage/audit-logs.js functions/lib/hono/routes/manage/__tests__/audit-logs-routes.test.js functions/lib/hono/_shared/__tests__/auth-helpers.audit.test.js`

Expected: 仅包含本轮三类修复及对应测试

**Step 4: Commit**

```bash
git add functions/lib/hono/_shared/audit-helpers.js functions/lib/hono/routes/manage/audit-logs.js functions/lib/hono/routes/manage/__tests__/audit-logs-routes.test.js functions/lib/hono/_shared/__tests__/auth-helpers.audit.test.js
git commit -m "fix(audit): close export provenance and read-trace gaps"
```

### Task 5: 同步运维文档

**Files:**
- Modify: `docs/admin-manual/audit-operations.md`

**Step 1: Write the failing doc expectation**

明确本轮文档应体现三件事：

- CSV 导出会对危险单元格做安全转义
- `source_app` / IP / request id 现在只来自服务端可信上下文
- 查看审计日志与查看动作列表本身也会留下审计记录

**Step 2: Update the document**

在导出流程和说明章节补充以上变更，避免运维按旧行为理解系统。

**Step 3: Verify docs diff**

Run: `git diff -- docs/admin-manual/audit-operations.md`

Expected: 只出现本轮行为更新

**Step 4: Commit**

```bash
git add docs/admin-manual/audit-operations.md
git commit -m "docs(audit): document export hardening and read traces"
```
