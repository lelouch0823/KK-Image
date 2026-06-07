# 后端代码重复定义审查报告

**审查日期**: 2026-03-03
**审查范围**: `functions/` 目录下所有后端代码
**审查目的**: 识别可抽取的重复代码模式，减少代码冗余，提高可维护性

---

## 目录

1. [执行摘要](#一执行摘要)
2. [重复代码模式详细分析](#二重复代码模式详细分析)
3. [具体代码位置清单](#三具体代码位置清单)
4. [重构建议与方案](#四重构建议与方案)
5. [实施计划](#五实施计划)
6. [风险评估与注意事项](#六风险评估与注意事项)

---

## 一、执行摘要

### 1.1 问题总览

| 优先级 | 重复模式             | 出现次数 | 涉及文件数 | 估计可减少代码量 | 技术债务等级 |
| ------ | -------------------- | -------- | ---------- | ---------------- | ------------ |
| 🔴 P0  | 分页参数验证逻辑     | 48处     | 8个文件    | ~200行           | 高           |
| 🔴 P0  | JSON 解析辅助函数    | 19处     | 6个文件    | ~80行            | 高           |
| 🔴 P0  | 空间查询重复 SQL     | 6处      | 1个文件    | ~150行           | 高           |
| 🟠 P1  | 时间戳获取模式       | 130处    | 25个文件   | ~100行           | 中           |
| 🟠 P1  | COUNT 查询模式       | 44处     | 15个文件   | ~50行            | 中           |
| 🟠 P1  | SQL SET 子句构建     | 3处      | 3个文件    | ~30行            | 中           |
| 🟡 P2  | UUID 生成调用        | 10处     | 5个文件    | ~20行            | 低           |
| 🟡 P2  | result.meta?.changes | 9处      | 4个文件    | ~20行            | 低           |
| 🟡 P2  | snake_case 转换      | 多处     | 多个路由   | ~80行            | 低           |

**总计**: 约 **530行** 重复代码可被消除

### 1.2 影响评估

- **维护成本**: 修改一个逻辑需要同步修改 3-8 个位置
- **Bug 风险**: 不一致的实现可能导致边缘情况行为差异
- **测试覆盖**: 分散的实现增加了测试复杂度
- **新人上手**: 多种实现方式增加理解成本

---

## 二、重复代码模式详细分析

### 2.1 分页参数验证逻辑 🔴 P0

#### 问题描述

几乎每个 Repository 的 `list/search` 方法都有相同的分页参数验证代码。这种重复不仅增加了代码量，还导致不同 Repository 可能有微小的实现差异。

#### 重复代码对比

**FileRepository.js:121-122**

```javascript
const safePage = Math.max(1, Math.floor(Number(page) || 1));
const safeLimit = Math.min(100, Math.max(1, Math.floor(Number(limit) || 50)));
```

**CustomerRepository.js:52-54**

```javascript
const safePage = Math.max(1, Math.floor(Number(page) || 1));
const safeLimit = Math.min(100, Math.max(1, Math.floor(Number(limit) || 20)));
const offset = (safePage - 1) * safeLimit;
```

**ProductRepository.js:287-288**

```javascript
const safePage = Math.max(1, Math.floor(Number(filters.page) || 1));
const safeLimit = filters.limit ? Math.min(100, Math.max(1, Math.floor(Number(filters.limit)))) : 0;
```

**order/queries.js:91-93**

```javascript
const safePage = Math.max(1, Math.floor(Number(page) || 1));
const safeLimit = Math.min(100, Math.max(1, Math.floor(Number(limit) || 20)));
const offset = (safePage - 1) * safeLimit;
```

#### 差异点分析

| 文件                     | 默认 limit | 最大 limit | offset 计算 | 无 limit 时行为    |
| ------------------------ | ---------- | ---------- | ----------- | ------------------ |
| FileRepository           | 50         | 100        | ✅          | 返回全部 (limit=0) |
| CustomerRepository       | 20         | 100        | ✅          | 使用默认值         |
| ProductRepository        | 20         | 100        | ✅          | 返回全部 (limit=0) |
| order/queries            | 20         | 100        | ✅          | 使用默认值         |
| FolderRepository         | 20         | 100        | ✅          | 使用默认值         |
| SalespersonRepository    | 50         | 100        | ✅          | 使用默认值         |
| PurchaseOrderRepository  | 20         | 100        | ✅          | 使用默认值         |
| ProductVariantRepository | 10         | 20         | ❌          | 使用默认值         |

**问题**: 默认值和最大值不一致，行为不完全统一。

---

### 2.2 JSON 解析辅助函数 🔴 P0

#### 问题描述

多个 Repository 和 Service 都有私有的 `_parseJson` 或类似方法，实现稍有不同，导致潜在的不一致行为。

#### 重复代码对比

**PurchaseOrderRepository.js:401-403**

```javascript
_parseJson(str) {
  try {
    return typeof str === 'string' ? JSON.parse(str) : (str || []);
  } catch {
    return [];
  }
}
```

**PurchaseOrderService.js:381-383**

```javascript
_parseJson(str) {
  try {
    return typeof str === 'string' ? JSON.parse(str) : (str || []);
  } catch {
    return [];
  }
}
```

**order/helpers.js:14-20** (已有参考实现)

```javascript
export function parseJson(jsonStr) {
  try {
    return jsonStr ? JSON.parse(jsonStr) : {};
  } catch (e) {
    console.warn('JSON parse failed:', e);
    return {};
  }
}
```

**products/index.js:69** (路由层定义)

```javascript
const parseJsonSafe = (value, fallback) => {
  if (!value) return fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
};
```

**ProductVariantRepository.js:93** (内联版本)

```javascript
return (results.results || []).map((r) => ({
  ...r,
  options_values: JSON.parse(r.options_values || '{}'),
}));
```

**ProductRepository.js:342-344** (内联版本)

```javascript
images: JSON.parse(item.images || '[]'),
specifications: JSON.parse(item.specifications || '{}'),
options: JSON.parse(item.options || '[]'),
```

#### 差异点分析

| 实现位置                 | 默认值 | 空值处理      | 错误日志 | 非字符串处理 |
| ------------------------ | ------ | ------------- | -------- | ------------ |
| PurchaseOrderRepository  | `[]`   | 返回 `[]`     | ❌       | 直接返回     |
| PurchaseOrderService     | `[]`   | 返回 `[]`     | ❌       | 直接返回     |
| order/helpers            | `{}`   | 返回 `{}`     | ✅       | 无处理       |
| products/index           | 可配置 | 返回 fallback | ❌       | 无处理       |
| ProductVariantRepository | `'{}'` | 返回 `{}`     | ❌       | 无处理       |
| ProductRepository        | 多种   | 各自处理      | ❌       | 无处理       |

**问题**: 默认值不一致（`{}` vs `[]`），日志行为不一致，边缘情况处理不同。

---

### 2.3 空间查询重复 SQL 片段 🔴 P0

#### 问题描述

`SpaceRepository.js` 中 6 个方法包含几乎完全相同的复杂 SQL SELECT 片段，总计约 150 行重复。

#### 重复 SQL 片段

以下 SQL 在 `findAll`, `findById`, `findByProductId`, `findSubspaces`, `findAllForSalesperson`, `findByIdForSalesperson` 中重复：

```sql
p.spu as p_sku,
p.brand as p_brand,
p.series as p_series,
COALESCE(pv.price, (SELECT MIN(price) FROM product_variants WHERE product_id = p.id), 0) as p_price,
p.specifications as p_specs,
p.images as p_images,
pv.sku as pv_sku,
pv.price as pv_price,
(
  SELECT vi.image_id
  FROM variant_images vi
  WHERE vi.variant_id = s.variant_id AND vi.is_primary = 1
  ORDER BY vi.sort_order ASC, vi.created_at ASC
  LIMIT 1
) as variant_primary_image_id,
COALESCE(
  (
    SELECT vi.image_id
    FROM variant_images vi
    WHERE vi.variant_id = s.variant_id AND vi.is_primary = 1
    ORDER BY vi.sort_order ASC, vi.created_at ASC
    LIMIT 1
  ),
  pv.image_id,
  json_extract(p.images, '$[0]')
) as display_image_id
```

**影响**:

- 修改显示图片逻辑需要同时修改 6 处
- SQL 优化无法集中进行
- 代码审查时容易遗漏某处

---

### 2.4 时间戳获取模式 🟠 P1

#### 问题描述

`Date.now()` 和 `now()` 函数混用，缺乏统一的时间戳处理。

#### 统计数据

| 调用方式            | 出现次数 | 主要位置                   |
| ------------------- | -------- | -------------------------- |
| `Date.now()`        | ~80处    | Repository, Service, Route |
| `now()`             | ~40处    | Repository, Utils          |
| `timestamp = now()` | ~15处    | Repository                 |

#### 混用示例

**同一文件内混用 - FileRepository.js**

```javascript
// 第 56 行
data.createdAt || Date.now(),
// 第 170 行
values.push(Date.now()); // updated_at
// 第 216 行
.bind(Date.now(), id)
```

**使用 now() - ProductVariantRepository.js**

```javascript
import { now } from '../api/utils/id.js';
// ...
const timestamp = now();
```

**问题**: 不一致的调用方式使代码风格不统一，且难以全局修改时间戳获取逻辑。

---

### 2.5 COUNT 查询模式 🟠 P1

#### 问题描述

大量相似的 `SELECT COUNT(*)` 查询分散在各个文件中。

#### 重复模式

**模式 A: 简单 COUNT**

```javascript
// SystemStatsRepository.js:19
this.db.prepare('SELECT COUNT(*) as count FROM customers').first();
```

**模式 B: 带 WHERE 条件**

```javascript
// OrderStatsRepository.js:55
.prepare(`SELECT COUNT(*) as count FROM orders WHERE created_at >= ?`)
.bind(timestamp).first()
```

**模式 C: 带子查询**

```javascript
// ProductRepository.js:314
const countQuery = `SELECT COUNT(*) as total FROM (${query}) q`;
```

**模式 D: 分组后计数**

```javascript
// OrderStatsRepository.js:196
SELECT status, COUNT(*) as count FROM orders GROUP BY status
```

#### 分布统计

| 文件                          | COUNT 查询数 |
| ----------------------------- | ------------ |
| OrderStatsRepository.js       | 15           |
| SystemStatsRepository.js      | 8            |
| repositories/order/queries.js | 3            |
| FolderRepository.js           | 4            |
| PurchaseOrderRepository.js    | 2            |
| 其他                          | 12           |

---

### 2.6 SQL SET 子句构建 🟠 P1

#### 问题描述

动态构建 SQL UPDATE SET 子句的重复模式。

#### 重复代码对比

**ProductRepository.js:230**

```javascript
const sets = Object.keys(updateData)
  .map((k) => `${k} = ?`)
  .join(', ');
const values = [...Object.values(updateData), id];
const result = await this.db
  .prepare(`UPDATE products SET ${sets} WHERE id = ?`)
  .bind(...values)
  .run();
```

**FileRepository.js:168**

```javascript
const setClause = safeKeys.map((k) => `${k} = ?`).join(', ');
const values = safeKeys.map((k) => updates[k]);
values.push(Date.now()); // updated_at
values.push(id);
await this.db
  .prepare(`UPDATE files SET ${setClause}, updated_at = ? WHERE id = ?`)
  .bind(...values)
  .run();
```

**PurchaseOrderRepository.js:181**

```javascript
const sets = Object.keys(updateData)
  .map((k) => `${k} = ?`)
  .join(', ');
const values = [...Object.values(updateData), id];
const result = await this.db
  .prepare(`UPDATE purchase_orders SET ${sets} WHERE id = ?`)
  .bind(...values)
  .run();
```

**差异**: 是否自动添加 `updated_at`，是否过滤允许更新的字段。

---

### 2.7 UUID 生成调用 🟡 P2

#### 问题描述

直接使用 `crypto.randomUUID()` 与使用 `generateId()` 不一致。

#### 直接使用 crypto.randomUUID()

| 文件                                    | 行号 | 用途            |
| --------------------------------------- | ---- | --------------- |
| api/cron/reminders.js                   | 46   | 创建提醒 ID     |
| api/cron/reminders.js                   | 102  | 创建通知 ID     |
| api/cron/reminders.js                   | 125  | 创建管理员 ID   |
| repositories/PurchaseOrderRepository.js | 51   | 创建采购单 ID   |
| repositories/PurchaseOrderRepository.js | 230  | 创建明细 ID     |
| repositories/CustomerRepository.js      | 125  | 创建客户 ID     |
| repositories/ProductRepository.js       | 56   | 创建商品 ID     |
| repositories/ProductRepository.js       | 111  | 批量创建商品 ID |

#### 使用 generateId() 的参考实现

```javascript
// api/utils/id.js
export function generateId() {
  return crypto.randomUUID();
}

// 正确用法示例 - SalespersonRepository.js:91
import { generateId } from '../api/utils/id.js';
const id = generateId();
```

---

### 2.8 result.meta?.changes 检查 🟡 P2

#### 问题描述

检查 D1 操作影响的行数有多种写法。

#### 重复模式

**模式 A: 简单检查**

```javascript
// ProductVariantRepository.js:210
return result.meta?.changes > 0;
```

**模式 B: 带 null 保护**

```javascript
// ProductVariantRepository.js:235
return (result.meta?.changes || 0) > 0;
```

**模式 C: 返回具体数字**

```javascript
// ProductRepository.js:240
changes: result.meta?.changes || 0;
```

**模式 D: 用于条件判断**

```javascript
// PurchaseOrderRepository.js:270
return result.meta?.changes > 0;
```

---

## 三、具体代码位置清单

### 3.1 分页验证逻辑位置

| 文件                                       | 行号范围 | 方法名                |
| ------------------------------------------ | -------- | --------------------- |
| `repositories/FileRepository.js`           | 121-122  | `findAll()`           |
| `repositories/FolderRepository.js`         | 250-252  | `findShared()`        |
| `repositories/FolderRepository.js`         | 294-296  | `list()`              |
| `repositories/CustomerRepository.js`       | 52-54    | `list()`              |
| `repositories/SalespersonRepository.js`    | 81-83    | `list()`              |
| `repositories/ProductRepository.js`        | 287-288  | `search()`            |
| `repositories/PurchaseOrderRepository.js`  | 117-118  | `list()`              |
| `repositories/ProductVariantRepository.js` | 112      | `searchForAI()`       |
| `repositories/order/queries.js`            | 91-93    | `listBySalesperson()` |
| `repositories/order/queries.js`            | 160-162  | `listForAdmin()`      |

### 3.2 JSON 解析位置

| 文件                                       | 行号范围 | 类型                    |
| ------------------------------------------ | -------- | ----------------------- |
| `repositories/PurchaseOrderRepository.js`  | 401-403  | `_parseJson()` 方法定义 |
| `repositories/PurchaseOrderRepository.js`  | 105-107  | 内联调用                |
| `services/PurchaseOrderService.js`         | 381-383  | `_parseJson()` 方法定义 |
| `services/PurchaseOrderService.js`         | 279-281  | 内联调用                |
| `repositories/ProductVariantRepository.js` | 93       | 内联 `JSON.parse`       |
| `repositories/ProductVariantRepository.js` | 99       | 内联 `JSON.parse`       |
| `repositories/ProductVariantRepository.js` | 108      | 内联 `JSON.parse`       |
| `repositories/ProductVariantRepository.js` | 173      | 内联 `JSON.parse`       |
| `repositories/ProductRepository.js`        | 342-344  | `_parseResult()` 内联   |
| `repositories/order/helpers.js`            | 14-20    | `parseJson()` 函数定义  |
| `lib/hono/routes/manage/products/index.js` | 69       | `parseJsonSafe()` 定义  |

### 3.3 时间戳调用位置 (部分)

| 文件                                       | 使用 `Date.now()`           | 使用 `now()`          |
| ------------------------------------------ | --------------------------- | --------------------- |
| `repositories/FileRepository.js`           | 56,57,87,88,170,185,216,227 | -                     |
| `repositories/FolderRepository.js`         | 130,131,151,359             | -                     |
| `repositories/CustomerRepository.js`       | 126,186                     | -                     |
| `repositories/ProductRepository.js`        | 55,98,205,272               | -                     |
| `repositories/ProductVariantRepository.js` | -                           | 48,206,291            |
| `repositories/PurchaseOrderRepository.js`  | 52,180,198,199,219          | -                     |
| `repositories/SalespersonRepository.js`    | -                           | 144                   |
| `repositories/NotificationRepository.js`   | -                           | 45,80                 |
| `repositories/order/mutations.js`          | -                           | 32,80,125,176,204,266 |

### 3.4 SpaceRepository 重复 SQL 位置

| 方法名                     | 行号范围 | 重复片段类型                    |
| -------------------------- | -------- | ------------------------------- |
| `findAll()`                | 17-58    | 完整 SELECT + JOIN              |
| `findById()`               | 107-134  | 完整 SELECT + JOIN              |
| `findByProductId()`        | 68-106   | 完整 SELECT + JOIN (带 WHERE)   |
| `findSubspaces()`          | 338-393  | 完整 SELECT + JOIN (带 WHERE)   |
| `findAllForSalesperson()`  | 418-471  | 完整 SELECT + JOIN (带权限检查) |
| `findByIdForSalesperson()` | 479-529  | 完整 SELECT + JOIN (带权限检查) |

---

## 四、重构建议与方案

### 4.1 分页验证重构

#### 方案 A: 扩展现有 parsePagination

**位置**: `functions/lib/hono/_shared/route-helpers.js`

```javascript
/**
 * 从请求或参数中解析分页参数
 * @param {Object|number} pageOrContext - 页码或 Hono context
 * @param {number} [limit] - 每页数量
 * @param {Object} [options] - 配置选项
 * @returns {{ page: number, limit: number, offset: number }}
 */
export function parsePagination(pageOrContext, limit, options = {}) {
  const defaults = { limit: 20, maxLimit: 100, ...options };

  let page, limitValue;

  // 支持两种调用方式
  if (typeof pageOrContext === 'object' && pageOrContext.req) {
    // Hono context 模式
    page = parseInt(pageOrContext.req.query('page') || '1', 10);
    limitValue = parseInt(pageOrContext.req.query('limit') || String(defaults.limit), 10);
  } else {
    // 直接参数模式
    page = pageOrContext;
    limitValue = limit ?? defaults.limit;
  }

  const safePage = Math.max(1, Math.floor(Number(page) || 1));
  const safeLimit = Math.min(
    defaults.maxLimit,
    Math.max(1, Math.floor(Number(limitValue) || defaults.limit))
  );

  return { page: safePage, limit: safeLimit, offset: (safePage - 1) * safeLimit };
}
```

#### 方案 B: 在 Repository 层使用

```javascript
// 在 Repository 中使用
import { parsePagination } from '../lib/hono/_shared/route-helpers.js';

async list(filters = {}) {
  const { page, limit, offset } = parsePagination(filters.page, filters.limit);
  // ...
}
```

---

### 4.2 JSON 解析重构

#### 推荐方案: 统一工具函数

**位置**: `functions/api/utils/json.js` (新建)

```javascript
/**
 * 安全解析 JSON 字符串
 * @param {string|any} value - 待解析值
 * @param {any} defaultValue - 解析失败时的默认值
 * @returns {any}
 */
export function safeJsonParse(value, defaultValue = null) {
  if (value === null || value === undefined) return defaultValue;
  if (typeof value !== 'string') return value;
  try {
    return JSON.parse(value);
  } catch (e) {
    console.warn('JSON parse failed:', e.message);
    return defaultValue;
  }
}

// 常用快捷方式
export const parseJsonArray = (value) => safeJsonParse(value, []);
export const parseJsonObject = (value) => safeJsonParse(value, {});
```

**在 \_shared/utils.js 中导出**:

```javascript
// 添加到 functions/_shared/utils.js
export { safeJsonParse, parseJsonArray, parseJsonObject } from '../api/utils/json.js';
```

---

### 4.3 SpaceRepository SQL 重构

#### 推荐方案: 私有方法封装

```javascript
// 在 SpaceRepository 类中添加

/**
 * 空间查询的基础 SELECT 片段 (商品 + 变体信息)
 * @private
 */
_spaceProductSelect() {
  return `
    p.spu as p_sku, p.brand as p_brand, p.series as p_series,
    COALESCE(pv.price, (SELECT MIN(price) FROM product_variants WHERE product_id = p.id), 0) as p_price,
    p.specifications as p_specs, p.images as p_images,
    pv.sku as pv_sku, pv.price as pv_price
  `;
}

/**
 * 变体显示图片的 SELECT 片段
 * @private
 */
_variantImageSelect() {
  return `
    (SELECT vi.image_id FROM variant_images vi
     WHERE vi.variant_id = s.variant_id AND vi.is_primary = 1
     ORDER BY vi.sort_order ASC, vi.created_at ASC LIMIT 1) as variant_primary_image_id,
    COALESCE(
      (SELECT vi.image_id FROM variant_images vi
       WHERE vi.variant_id = s.variant_id AND vi.is_primary = 1
       ORDER BY vi.sort_order ASC, vi.created_at ASC LIMIT 1),
      pv.image_id,
      json_extract(p.images, '$[0]')
    ) as display_image_id
  `;
}

/**
 * 完整的空间 SELECT 语句 (不含 WHERE)
 * @private
 */
_fullSpaceSelect() {
  return `
    SELECT s.*,
      ${this._spaceProductSelect()},
      ${this._variantImageSelect()},
      COALESCE(sf_count.file_count, 0) as file_count,
      f.storage_key as cover_storage_key
    FROM spaces s
    LEFT JOIN (
      SELECT space_id, COUNT(*) as file_count FROM space_files GROUP BY space_id
    ) sf_count ON sf_count.space_id = s.id
    LEFT JOIN files f ON s.cover_file_id = f.id
    LEFT JOIN products p ON s.product_id = p.id
    LEFT JOIN product_variants pv ON s.variant_id = pv.id
  `;
}
```

---

### 4.4 时间戳统一方案

#### 推荐方案: 渐进式迁移

1. **保持现有 `now()` 函数**: `functions/api/utils/id.js`
2. **在 `_shared/utils.js` 中已导出**
3. **逐步替换直接 `Date.now()` 调用**

```javascript
// 批量替换正则
// 搜索: Date\.now\(\)
// 替换为: now()
// 前提: 确保文件已 import { now } from '...'
```

---

### 4.5 SQL SET 子句构建

**位置**: `functions/api/utils/sql.js` (扩展现有文件)

```javascript
/**
 * 构建 SQL UPDATE SET 子句
 * @param {Object} data - 要更新的数据
 * @param {string[]|Set|null} allowedFields - 允许更新的字段列表
 * @param {Object} options - 配置选项
 * @returns {{ clause: string, values: any[], keys: string[] }|null}
 */
export function buildSetClause(data, allowedFields = null, options = {}) {
  const { autoTimestamp = true } = options;

  let keys = Object.keys(data);

  if (allowedFields) {
    const allowed = allowedFields instanceof Set ? allowedFields : new Set(allowedFields);
    keys = keys.filter((k) => allowed.has(k));
  }

  if (keys.length === 0) return null;

  const values = keys.map((k) => data[k]);

  if (autoTimestamp) {
    keys.push('updated_at');
    values.push(Date.now());
  }

  return {
    clause: keys.map((k) => `${k} = ?`).join(', '),
    values,
    keys,
  };
}
```

---

### 4.6 D1 结果检查

**位置**: `functions/api/utils/d1.js` (新建)

```javascript
/**
 * 检查 D1 操作是否影响了记录
 * @param {Object} result - D1 执行结果
 * @returns {boolean}
 */
export function hasChanges(result) {
  return (result?.meta?.changes || 0) > 0;
}

/**
 * 获取 D1 操作影响的记录数
 * @param {Object} result - D1 执行结果
 * @returns {number}
 */
export function getChangesCount(result) {
  return result?.meta?.changes || 0;
}
```

---

## 五、实施计划

### 阶段一: 基础工具 (1-2天)

| 任务                 | 文件                                | 优先级 |
| -------------------- | ----------------------------------- | ------ |
| 创建 JSON 解析工具   | `api/utils/json.js`                 | P0     |
| 扩展 parsePagination | `lib/hono/_shared/route-helpers.js` | P0     |
| 创建 D1 结果工具     | `api/utils/d1.js`                   | P2     |

### 阶段二: Repository 重构 (2-3天)

| 任务                     | 涉及文件                    | 优先级 |
| ------------------------ | --------------------------- | ------ |
| 迁移分页验证             | 8个 Repository 文件         | P0     |
| 迁移 JSON 解析           | 6个 Repository/Service 文件 | P0     |
| 重构 SpaceRepository SQL | `SpaceRepository.js`        | P0     |

### 阶段三: 统一化 (1-2天)

| 任务           | 涉及文件           | 优先级 |
| -------------- | ------------------ | ------ |
| 扩展 SQL 工具  | `api/utils/sql.js` | P1     |
| 统一 UUID 生成 | 5个文件            | P2     |
| 渐进迁移时间戳 | 25个文件           | P1     |

---

## 六、风险评估与注意事项

### 6.1 风险矩阵

| 风险         | 可能性 | 影响 | 缓解措施                 |
| ------------ | ------ | ---- | ------------------------ |
| 重构引入 Bug | 中     | 高   | 编写单元测试，渐进式迁移 |
| 行为变更     | 低     | 中   | 保持默认值兼容性         |
| 性能影响     | 低     | 低   | 工具函数开销可忽略       |
| 遗漏迁移点   | 中     | 低   | 使用全局搜索验证         |

### 6.2 测试要求

1. **新增工具函数**: 100% 单元测试覆盖
2. **迁移的 Repository**: 确保现有测试通过
3. **集成测试**: 验证 API 行为不变

### 6.3 回滚策略

- 保留原有方法的别名，标记为 `@deprecated`
- 使用 Git 分支隔离重构变更
- 分阶段提交，便于问题定位

---

## 七、附录

### A. 现有良好封装参考

| 文件                                | 封装内容                        | 可复用性        |
| ----------------------------------- | ------------------------------- | --------------- |
| `_shared/utils.js`                  | Barrel File 设计                | ✅ 已使用       |
| `api/utils/sql.js`                  | `inClause`, `placeholders`      | ✅ 已使用       |
| `api/utils/id.js`                   | `generateId`, `now`             | ⚠️ 部分使用     |
| `lib/hono/_shared/route-helpers.js` | `parsePagination`               | ⚠️ 仅路由层使用 |
| `repositories/order/helpers.js`     | `parseJson`, `mapOrderListItem` | ❌ 未复用       |

### B. 代码行数统计

```
functions/
├── repositories/          # 主要重复区域
│   ├── FileRepository.js       (~300行)
│   ├── FolderRepository.js     (~400行)
│   ├── SpaceRepository.js      (~530行, 含大量重复SQL)
│   ├── ProductRepository.js    (~350行)
│   ├── CustomerRepository.js   (~230行)
│   ├── SalespersonRepository.js (~290行)
│   ├── PurchaseOrderRepository.js (~410行)
│   └── order/
│       ├── queries.js          (~250行)
│       └── helpers.js          (~70行)
├── services/
│   └── PurchaseOrderService.js (~400行)
└── lib/hono/routes/
    └── manage/products/index.js (~200行)
```

---

**报告生成时间**: 2026-03-03
**审查工具**: 代码静态分析 + 人工审查
**建议审核人**: 后端开发负责人
