# Backend Code Duplication SOTA Remediation Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 在不改变对外 API 行为的前提下，消除后端重复实现并统一关键基础能力（分页、JSON 解析、D1 变更检查、SQL 片段复用、ID/时间戳策略）。

**Architecture:** 采用“兼容优先 + 渐进迁移”策略。先新增可测试的共享工具并以适配层接入，再按 P0 -> P1 -> P2 的顺序分批替换调用点，最后通过回归测试与 grep 审计收敛重复实现。对 `SpaceRepository` 采用查询片段私有化重构，确保 SQL 行为等价。

**Tech Stack:** Cloudflare Workers (D1), Hono, Vitest, ES Modules, ripgrep

---

### Task 1: 建立基线审计与回归护栏

**Files:**

- Create: `docs/reviews/2026-03-03-backend-code-duplication-validation.md`
- Create: `scripts/audit-backend-duplication.ps1`

**Step 1: 写基线审计脚本（只读）**

```powershell
# scripts/audit-backend-duplication.ps1
rg -n "const safePage =|const safeLimit =" functions/repositories functions/services
rg -n "_parseJson\(|JSON\.parse\(" functions/repositories functions/services functions/lib/hono/routes
rg -n "variant_primary_image_id|display_image_id" functions/repositories/SpaceRepository.js
rg -n "Date\.now\(\)|(?<!Date\.)\bnow\(\)" -P functions
rg -n "crypto\.randomUUID\(" functions/repositories functions/api/cron
rg -n "result\.meta\?\.changes" functions
```

**Step 2: 运行脚本并保存结果摘要**

Run: `powershell -ExecutionPolicy Bypass -File scripts/audit-backend-duplication.ps1`
Expected: 输出所有重复热点，且可复现当前审计结论。

**Step 3: 在 validation 文档记录“真实/部分真实/不成立”结论**

```markdown
- [真实] SpaceRepository 重复 SQL
- [真实] JSON 解析实现分叉
- [部分真实] snake_case 转换（存在重复但不全是坏味道）
```

**Step 4: Commit**

```bash
git add docs/reviews/2026-03-03-backend-code-duplication-validation.md scripts/audit-backend-duplication.ps1
git commit -m "docs: add validated backend duplication baseline and audit script"
```

### Task 2: 统一 JSON 解析能力（P0）

**Files:**

- Create: `functions/api/utils/json.js`
- Create: `functions/api/utils/__tests__/json.test.js`
- Modify: `functions/_shared/utils.js`

**Step 1: 先写失败测试（工具层）**

```javascript
import { describe, it, expect } from 'vitest';
import { safeJsonParse, parseJsonArray, parseJsonObject } from '../json.js';

describe('json utils', () => {
  it('returns fallback on invalid json', () => {
    expect(safeJsonParse('{', [])).toEqual([]);
  });
  it('returns non-string input as-is', () => {
    expect(safeJsonParse({ a: 1 }, {})).toEqual({ a: 1 });
  });
});
```

**Step 2: 跑单测确认失败**

Run: `pnpm test:unit -- functions/api/utils/__tests__/json.test.js`
Expected: FAIL，提示 `safeJsonParse` 未定义。

**Step 3: 实现最小可用 JSON 工具并导出**

```javascript
export function safeJsonParse(value, fallback = null) {
  /* ... */
}
export const parseJsonArray = (value) => safeJsonParse(value, []);
export const parseJsonObject = (value) => safeJsonParse(value, {});
```

**Step 4: 跑测试确认通过**

Run: `pnpm test:unit -- functions/api/utils/__tests__/json.test.js`
Expected: PASS。

**Step 5: Commit**

```bash
git add functions/api/utils/json.js functions/api/utils/__tests__/json.test.js functions/_shared/utils.js
git commit -m "feat: add unified json parse utilities with tests"
```

### Task 3: 统一 Repository 分页解析能力（P0）

**Files:**

- Create: `functions/api/utils/pagination.js`
- Create: `functions/api/utils/__tests__/pagination.test.js`
- Modify: `functions/lib/hono/_shared/route-helpers.js`
- Modify: `functions/_shared/utils.js`

**Step 1: 写失败测试，覆盖边界行为**

```javascript
import { parseRepoPagination } from '../pagination.js';

it('clamps invalid page/limit and returns offset', () => {
  expect(
    parseRepoPagination({ page: 'x', limit: '999' }, { defaultLimit: 20, maxLimit: 100 })
  ).toEqual({ page: 1, limit: 100, offset: 0 });
});
```

**Step 2: 跑测试确认失败**

Run: `pnpm test:unit -- functions/api/utils/__tests__/pagination.test.js`
Expected: FAIL，提示 `parseRepoPagination` 不存在。

**Step 3: 实现工具并修复 route-helpers 的 NaN 漏洞**

```javascript
export function toPositiveInt(value, fallback) {
  /* ... */
}
export function parseRepoPagination(input, options) {
  /* ... */
}
```

**Step 4: 回归 route-helpers**

Run: `pnpm test:unit -- functions/api/utils/__tests__/pagination.test.js`
Expected: PASS。

**Step 5: Commit**

```bash
git add functions/api/utils/pagination.js functions/api/utils/__tests__/pagination.test.js functions/lib/hono/_shared/route-helpers.js functions/_shared/utils.js
git commit -m "feat: add unified pagination parser and harden route pagination"
```

### Task 4: 统一 D1 变更检查与动态 SET 子句构建（P1/P2）

**Files:**

- Create: `functions/api/utils/d1.js`
- Create: `functions/api/utils/__tests__/d1.test.js`
- Modify: `functions/api/utils/sql.js`
- Create: `functions/api/utils/__tests__/sql-set-clause.test.js`
- Modify: `functions/_shared/utils.js`

**Step 1: 先写失败测试（D1）**

```javascript
import { hasChanges, getChangesCount } from '../d1.js';

it('handles undefined result safely', () => {
  expect(hasChanges(undefined)).toBe(false);
  expect(getChangesCount(undefined)).toBe(0);
});
```

**Step 2: 先写失败测试（SET 子句）**

```javascript
import { buildSetClause } from '../sql.js';

it('builds filtered set clause and values', () => {
  const built = buildSetClause({ a: 1, b: 2 }, ['a'], { autoTimestamp: false });
  expect(built.clause).toBe('a = ?');
  expect(built.values).toEqual([1]);
});
```

**Step 3: 跑测试确认失败**

Run: `pnpm test:unit -- functions/api/utils/__tests__/d1.test.js functions/api/utils/__tests__/sql-set-clause.test.js`
Expected: FAIL，缺少对应导出函数。

**Step 4: 实现并导出新工具**

```javascript
export function hasChanges(result) {
  return (result?.meta?.changes || 0) > 0;
}
export function getChangesCount(result) {
  return result?.meta?.changes || 0;
}
export function buildSetClause(data, allowedFields, options = {}) {
  /* ... */
}
```

**Step 5: 跑测试确认通过并提交**

Run: `pnpm test:unit -- functions/api/utils/__tests__/d1.test.js functions/api/utils/__tests__/sql-set-clause.test.js`
Expected: PASS。

```bash
git add functions/api/utils/d1.js functions/api/utils/__tests__/d1.test.js functions/api/utils/sql.js functions/api/utils/__tests__/sql-set-clause.test.js functions/_shared/utils.js
git commit -m "feat: add d1 helpers and reusable sql set-clause builder"
```

### Task 5: 重构 SpaceRepository 重复 SQL（P0）

**Files:**

- Modify: `functions/repositories/SpaceRepository.js`
- Modify: `functions/repositories/__tests__/SpaceRepository.test.js`

**Step 1: 写失败测试，锁定核心查询字段完整性**

```javascript
it('findAll and findSubspaces include consistent variant image projections', async () => {
  // assert query result fields: variant_primary_image_id, display_image_id
});
```

**Step 2: 跑测试确认失败（先 red）**

Run: `pnpm test:unit -- functions/repositories/__tests__/SpaceRepository.test.js`
Expected: FAIL（新增断言尚未满足）。

**Step 3: 提取私有 SQL 片段**

```javascript
_baseProductProjection() { /* ... */ }
_variantImageProjection() { /* ... */ }
_commonSpaceFromClause() { /* ... */ }
```

**Step 4: 替换 6 个方法中的重复 SELECT 片段**

- `findAll`
- `findById`
- `findByProductId`
- `findSubspaces`
- `findAllForSalesperson`
- `findByIdForSalesperson`

**Step 5: 跑测试确认通过并提交**

Run: `pnpm test:unit -- functions/repositories/__tests__/SpaceRepository.test.js`
Expected: PASS。

```bash
git add functions/repositories/SpaceRepository.js functions/repositories/__tests__/SpaceRepository.test.js
git commit -m "refactor: deduplicate SpaceRepository select/join sql fragments"
```

### Task 6: 迁移 P0 调用点（分页 + JSON）

**Files:**

- Modify: `functions/repositories/FileRepository.js`
- Modify: `functions/repositories/FolderRepository.js`
- Modify: `functions/repositories/CustomerRepository.js`
- Modify: `functions/repositories/SalespersonRepository.js`
- Modify: `functions/repositories/ProductRepository.js`
- Modify: `functions/repositories/PurchaseOrderRepository.js`
- Modify: `functions/repositories/ProductVariantRepository.js`
- Modify: `functions/repositories/order/queries.js`
- Modify: `functions/services/PurchaseOrderService.js`
- Modify: `functions/lib/hono/routes/manage/products/index.js`

**Step 1: 对每个文件先加最小回归断言或现有测试用例扩展**

Run: `pnpm test:unit -- functions/repositories/__tests__`
Expected: 记录当前基线通过状态。

**Step 2: 分文件替换为共享工具（小步提交）**

- 分页逻辑统一为 `parseRepoPagination`。
- JSON 解析统一为 `parseJsonArray/parseJsonObject/safeJsonParse`。
- 保持原默认值语义（如 `ProductRepository` 的 `limit=0` 语义）。

**Step 3: 每替换 2-3 文件跑一次单测**

Run: `pnpm test:unit -- functions/repositories/__tests__ functions/api/utils/__tests__`
Expected: PASS。

**Step 4: Commit**

```bash
git add functions/repositories functions/services/PurchaseOrderService.js functions/lib/hono/routes/manage/products/index.js
git commit -m "refactor: migrate p0 pagination/json duplication to shared utilities"
```

### Task 7: 迁移 P1/P2 调用点（时间戳、UUID、D1 结果、SET 子句）

**Files:**

- Modify: `functions/repositories/PurchaseOrderRepository.js`
- Modify: `functions/repositories/ProductRepository.js`
- Modify: `functions/repositories/FileRepository.js`
- Modify: `functions/repositories/CustomerRepository.js`
- Modify: `functions/api/cron/reminders.js`
- Modify: `functions/lib/hono/routes/manage/products/[id].js`
- Modify: 其他 `result.meta?.changes` 调用点文件

**Step 1: 先修正明显异常语义**

- 将 `manage/products/[id].js` 的 `(changes >= 0)` 改为 `hasChanges(result)`。

**Step 2: 统一 UUID 策略**

- 业务代码统一改为 `generateId()`。
- 保留 `id.js` 内部 `crypto.randomUUID()` 作为底层实现。

**Step 3: 统一 D1 变更检查与 SET 构建**

- `result.meta?.changes` 统一改为 `hasChanges/getChangesCount`。
- 动态更新语句优先使用 `buildSetClause`。

**Step 4: 时间戳迁移采用“有 import 即替换”的保守策略**

- 先在 Repository 层替换为 `now()`；路由层先不强制全量替换，避免非业务性能计时代码被误改。

**Step 5: 回归与提交**

Run: `pnpm test:unit -- functions/repositories/__tests__ functions/api/utils/__tests__`
Expected: PASS。

```bash
git add functions/repositories functions/api/cron/reminders.js functions/lib/hono/routes/manage/products/[id].js
git commit -m "refactor: normalize uuid/timestamp/d1-change/set-clause patterns"
```

### Task 8: 最终验证、指标对比、发布检查

**Files:**

- Modify: `docs/reviews/2026-03-03-backend-code-duplication-validation.md`

**Step 1: 运行完整验证**

Run: `pnpm test:unit`
Expected: 全部 PASS。

Run: `pnpm lint`
Expected: 无 lint 错误。

Run: `pnpm build`
Expected: 构建成功。

**Step 2: 运行审计脚本做前后对比**

Run: `powershell -ExecutionPolicy Bypass -File scripts/audit-backend-duplication.ps1`
Expected: P0 重复模式显著下降，且结果可在 validation 文档中量化。

**Step 3: 更新文档中的迁移结果与残留项**

```markdown
- Removed: duplicated pagination blocks from 8 repositories
- Removed: duplicated json parse helpers from purchase/order/product modules
- Deferred: snake_case mapping in route DTO layer (intentional until mapper layer task)
```

**Step 4: Commit**

```bash
git add docs/reviews/2026-03-03-backend-code-duplication-validation.md
git commit -m "docs: finalize backend duplication remediation results and metrics"
```

---

## Execution Order and Guardrails

1. Strict order: Task 1 -> Task 8.
2. 每个 Task 必须先测试失败，再实现，再测试通过（TDD）。
3. 每个 Task 独立提交，禁止把多阶段改动压成一个提交。
4. 任一阶段出现行为回归，立即回滚到上一个 Task commit 并定位。
5. `snake_case -> camelCase` 映射在路由 DTO 层先标记为后续优化，不在本轮强制抽象。
