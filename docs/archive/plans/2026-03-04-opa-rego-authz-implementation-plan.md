# OPA/Rego Authorization Refactor Implementation Plan

## 执行状态

- 状态: Completed
- 完成日期: 2026-03-04
- 落地提交:
  - `914375d` Merge branch 'feat/opa-rego-authz'
  - `79723ec` fix(test): stabilize vitest runner and migration prefix imports

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 用 OPA/Rego 替换当前分叉的权限判定与权限定义来源，保证“单一策略源 + fail-closed + 可快速回滚”。

**Architecture:** 新增 `policy/` 作为权限真相源，构建期编译 Rego 到 WASM，运行时由 `functions/lib/authz` 统一评估授权。`auth` 中间件改为通过引擎判定，`/api/v1/permissions` 从同一策略元数据生成输出，删除重复手写定义。

**Tech Stack:** Cloudflare Pages Functions, Hono, OPA/Rego (WASM), Node.js scripts, Vitest, GitHub Actions

---

### Task 1: 建立策略目录与策略元数据（单一真相源）

**Files:**

- Create: `policy/authz.rego`
- Create: `policy/metadata.json`
- Create: `policy/tests/authz_test.rego`

**Step 1: 先写策略测试（失败）**

```rego
package kk.authz_test

import data.kk.authz

test_admin_allow_any {
  authz.allow with input as {"subject": {"role": "admin"}, "action": "files:delete"}
}
```

**Step 2: 运行测试确认失败**

Run: `opa test policy -v`  
Expected: FAIL，提示 `data.kk.authz.allow` 不存在。

**Step 3: 编写最小策略与元数据**

```rego
package kk.authz

default allow := false

allow if {
  input.subject.role == "admin"
}
```

```json
{
  "roles": ["admin", "manager", "sales", "viewer", "user"],
  "actions": [
    "files:read",
    "files:write",
    "files:delete",
    "folders:read",
    "folders:write",
    "folders:delete",
    "users:read",
    "users:write",
    "webhooks:read",
    "webhooks:write",
    "stats:read",
    "admin:full"
  ]
}
```

**Step 4: 跑测试确认通过**

Run: `opa test policy -v`  
Expected: PASS。

**Step 5: Commit**

```bash
git add policy/authz.rego policy/metadata.json policy/tests/authz_test.rego
git commit -m "feat(authz): add opa policy baseline and metadata"
```

### Task 2: 增加策略编译脚本与 npm 命令

**Files:**

- Create: `scripts/policy/compile-opa.mjs`
- Modify: `package.json`

**Step 1: 编写失败检查（无编译脚本）**

Run: `node scripts/policy/compile-opa.mjs`  
Expected: FAIL，文件不存在。

**Step 2: 编写编译脚本（Rego -> WASM）**

```javascript
import { execSync } from 'node:child_process';
execSync('opa build -t wasm -e kk/authz/allow policy/authz.rego -o policy/bundle.tar.gz', {
  stdio: 'inherit',
});
execSync(
  'opa build -t wasm -e kk/authz/decision policy/authz.rego -o policy/bundle-decision.tar.gz',
  { stdio: 'inherit' }
);
```

**Step 3: 在 `package.json` 增加脚本**

```json
{
  "scripts": {
    "authz:policy:test": "opa test policy -v",
    "authz:policy:build": "node scripts/policy/compile-opa.mjs"
  }
}
```

**Step 4: 运行脚本验证**

Run: `npm run authz:policy:test && npm run authz:policy:build`  
Expected: PASS，输出 bundle 产物。

**Step 5: Commit**

```bash
git add scripts/policy/compile-opa.mjs package.json
git commit -m "build(authz): add opa policy test and wasm build scripts"
```

### Task 3: 实现运行时授权引擎（OPA + fail-closed + 回滚开关）

**Files:**

- Create: `functions/lib/authz/opa-engine.js`
- Create: `functions/lib/authz/legacy-engine.js`
- Create: `functions/lib/authz/index.js`
- Create: `functions/lib/authz/__tests__/engine.test.js`

**Step 1: 先写失败单测**

```javascript
it('fails closed when opa eval throws', async () => {
  const allowed = await evaluatePermission({ engine: 'opa', input: {} });
  expect(allowed).toBe(false);
});
```

**Step 2: 运行测试确认失败**

Run: `npm run test:unit -- functions/lib/authz/__tests__/engine.test.js`  
Expected: FAIL，`evaluatePermission` 未定义。

**Step 3: 最小实现引擎路由**

```javascript
export async function evaluatePermission({ env, input, legacyCheck }) {
  const engine = (env.AUTHZ_ENGINE || 'opa').toLowerCase();
  if (engine === 'legacy') return legacyCheck();
  try {
    return await evaluateWithOpa(input, env);
  } catch {
    return false; // fail-closed
  }
}
```

**Step 4: 跑测试确认通过**

Run: `npm run test:unit -- functions/lib/authz/__tests__/engine.test.js`  
Expected: PASS。

**Step 5: Commit**

```bash
git add functions/lib/authz
git commit -m "feat(authz): add opa runtime engine with fail-closed and legacy switch"
```

### Task 4: 改造 `requirePermission` 接 OPA 引擎

**Files:**

- Modify: `functions/lib/hono/middleware/auth.js`
- Create: `functions/lib/hono/middleware/__tests__/auth-opa.test.js`

**Step 1: 先写失败测试**

```javascript
it('returns 403 when opa denies permission', async () => {
  // mock evaluatePermission => false
  expect(res.status).toBe(403);
});
```

**Step 2: 跑测试确认失败**

Run: `npm run test:unit -- functions/lib/hono/middleware/__tests__/auth-opa.test.js`  
Expected: FAIL，`auth.js` 尚未调用新引擎。

**Step 3: 修改中间件判定逻辑**

```javascript
const allowed = await evaluatePermission({
  env: c.env,
  input: {
    subject: user,
    action: permission,
    resource: { path: c.req.path },
    context: { method: c.req.method },
  },
  legacyCheck: () => hasPermission(user.role, permission) || user.permissions?.includes(permission),
});
if (!allowed) return c.json({ success: false, error: `${MSG.AUTH.FORBIDDEN}: ${permission}` }, 403);
```

**Step 4: 运行测试**

Run: `npm run test:unit -- functions/lib/hono/middleware/__tests__/auth-opa.test.js`  
Expected: PASS。

**Step 5: Commit**

```bash
git add functions/lib/hono/middleware/auth.js functions/lib/hono/middleware/__tests__/auth-opa.test.js
git commit -m "refactor(auth): route requirePermission through authz engine"
```

### Task 5: 统一权限查询接口为策略元数据输出

**Files:**

- Modify: `functions/lib/hono/routes/v1/permissions.js`
- Create: `functions/lib/hono/routes/v1/__tests__/permissions-contract.test.js`
- Modify: `functions/api/utils/messages.js`

**Step 1: 写失败契约测试**

```javascript
it('returns actions exactly from policy metadata', async () => {
  expect(Object.keys(body.data.permissions)).toEqual(expectedActions);
});
```

**Step 2: 跑测试确认失败**

Run: `npm run test:unit -- functions/lib/hono/routes/v1/__tests__/permissions-contract.test.js`  
Expected: FAIL，接口仍在使用旧来源。

**Step 3: 改造路由为“策略元数据 + 展示文案”拼装**

```javascript
const { actions, roles } = getPolicyMetadata();
return c.json({ success: true, data: { permissions: mapLabels(actions), roles } });
```

**Step 4: 跑测试确认通过**

Run: `npm run test:unit -- functions/lib/hono/routes/v1/__tests__/permissions-contract.test.js`  
Expected: PASS。

**Step 5: Commit**

```bash
git add functions/lib/hono/routes/v1/permissions.js functions/lib/hono/routes/v1/__tests__/permissions-contract.test.js functions/api/utils/messages.js
git commit -m "refactor(authz): serve permissions endpoint from policy metadata"
```

### Task 6: 退役重复定义并保留兼容壳

**Files:**

- Modify: `functions/api/utils/permissions.js`
- Create: `functions/api/utils/__tests__/permissions-compat.test.js`

**Step 1: 写失败测试（兼容导入）**

```javascript
it('legacy hasPermission delegates to authz metadata', () => {
  expect(hasPermission('admin', 'files:delete')).toBe(true);
});
```

**Step 2: 跑测试确认失败**

Run: `npm run test:unit -- functions/api/utils/__tests__/permissions-compat.test.js`  
Expected: FAIL。

**Step 3: 改为兼容壳（不再手写权限矩阵）**

```javascript
export { hasPermission, ROLES, PERMISSIONS } from '../../lib/authz/legacy-engine.js';
```

**Step 4: 跑测试确认通过**

Run: `npm run test:unit -- functions/api/utils/__tests__/permissions-compat.test.js`  
Expected: PASS。

**Step 5: Commit**

```bash
git add functions/api/utils/permissions.js functions/api/utils/__tests__/permissions-compat.test.js
git commit -m "chore(authz): replace duplicated permissions map with compatibility shim"
```

### Task 7: 加 migration 重号门禁

**Files:**

- Create: `scripts/check-migration-prefixes.mjs`
- Modify: `package.json`
- Create: `scripts/__tests__/check-migration-prefixes.test.js`

**Step 1: 写失败测试**

```javascript
it('fails on duplicate prefixes', async () => {
  await expect(checkPrefixes(['0001_a.sql', '0001_b.sql'])).rejects.toThrow(/duplicate/i);
});
```

**Step 2: 跑测试确认失败**

Run: `npm run test:unit -- scripts/__tests__/check-migration-prefixes.test.js`  
Expected: FAIL。

**Step 3: 实现检测脚本并挂到 npm**

```json
{
  "scripts": {
    "db:migrations:check-prefix": "node scripts/check-migration-prefixes.mjs"
  }
}
```

**Step 4: 跑校验**

Run: `npm run db:migrations:check-prefix`  
Expected: 当前仓库因重号报错（0002/0013/0047）。

**Step 5: Commit**

```bash
git add scripts/check-migration-prefixes.mjs scripts/__tests__/check-migration-prefixes.test.js package.json
git commit -m "ci(db): add duplicate migration prefix guard"
```

### Task 8: CI 接入 OPA 与门禁

**Files:**

- Modify: `.github/workflows/ci-test.yml`

**Step 1: 先写失败预期（本地手动）**

Run: `npm run authz:policy:test`  
Expected: 在未安装 OPA 时失败。

**Step 2: 在 CI 安装 OPA 并加入门禁顺序**

```yaml
- name: Install OPA
  run: |
    curl -L -o /usr/local/bin/opa https://openpolicyagent.org/downloads/latest/opa_linux_amd64_static
    chmod +x /usr/local/bin/opa
- name: Policy tests
  run: npm run authz:policy:test
- name: Migration prefix check
  run: npm run db:migrations:check-prefix
```

**Step 3: 保留现有测试命令并放在门禁后半段**

Run: `npm run ci-test`  
Expected: 仍可执行原有测试套件。

**Step 4: 本地 dry run**

Run: `npm run authz:policy:test && npm run db:migrations:check-prefix`  
Expected: policy 测试通过，migration 检查按当前数据失败（直到你修复编号）。

**Step 5: Commit**

```bash
git add .github/workflows/ci-test.yml
git commit -m "ci(authz): enforce opa policy tests and migration prefix guard"
```

### Task 9: 收尾验证与发布说明

**Files:**

- Create: `docs/reviews/2026-03-04-opa-rego-authz-verification.md`
- Modify: `README.md`

**Step 1: 执行全量验证**

Run:

1. `npm run lint`
2. `npm run test:unit`
3. `npm run authz:policy:test`
4. `npm run db:migrations:check-prefix`

Expected: 除 migration 重号外全部通过；修复重号后全绿。

**Step 2: 记录验证证据**

```markdown
- auth middleware deny path: PASS
- permissions contract with policy metadata: PASS
- policy tests: PASS
- migration duplicate prefix gate: PASS
```

**Step 3: 更新 README 运维开关说明**

```markdown
AUTHZ_ENGINE=opa|legacy

- default: opa
- opa failure mode: fail-closed
```

**Step 4: 最终提交**

```bash
git add docs/reviews/2026-03-04-opa-rego-authz-verification.md README.md
git commit -m "docs(authz): add opa rollout verification and ops guide"
```

**Step 5: 发布检查**

Run: `git status --short`  
Expected: 工作区干净，可发布。
