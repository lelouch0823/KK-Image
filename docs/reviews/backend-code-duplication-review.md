# 后端代码重复定义审查报告

**审查日期**: 2026-03-03
**审查范围**: `functions/` 目录下所有后端代码

---

## 一、重复代码模式总览

| 优先级 | 重复模式 | 出现次数 | 涉及文件数 | 估计可减少代码量 |
|--------|----------|----------|------------|------------------|
| 🔴 高 | 分页参数验证逻辑 | 48处 | 8个文件 | ~200行 |
| 🔴 高 | JSON 解析辅助函数 | 19处 | 6个文件 | ~80行 |
| 🟠 中 | 时间戳获取模式 | 130处 | 25个文件 | ~100行 |
| 🟠 中 | COUNT 查询模式 | 44处 | 15个文件 | ~150行 |
| 🟠 中 | SQL SET 子句构建 | 3处 | 3个文件 | ~30行 |
| 🟡 低 | UUID 生成调用 | 10处 | 5个文件 | ~20行 |
| 🟡 低 | result.meta?.changes 检查 | 9处 | 4个文件 | ~20行 |
| 🟡 低 | 空间查询中的重复 SELECT 片段 | 6处 | 1个文件 | ~100行 |

---

## 二、高优先级重复模式

### 2.1 分页参数验证逻辑 🔴

**问题**: 几乎每个 Repository 的 list 方法都有相同的分页参数验证代码。

**重复位置**:
```
repositories/SalespersonRepository.js:81-83
repositories/PurchaseOrderRepository.js:117-118
repositories/ProductVariantRepository.js:112
repositories/ProductRepository.js:287-288
repositories/order/queries.js:91-93, 160-162
repositories/FolderRepository.js:250-252
repositories/CustomerRepository.js:52-54
repositories/FileRepository.js:121-122
```

**重复代码示例**:
```javascript
// 每个文件都有类似的代码
const safePage = Math.max(1, Math.floor(Number(page) || 1));
const safeLimit = Math.min(100, Math.max(1, Math.floor(Number(limit) || 20)));
const offset = (safePage - 1) * safeLimit;
```

**建议抽取方案**:
```javascript
// functions/lib/db/pagination.js
export function sanitizePagination(page, limit, defaults = {}) {
  const defaultLimit = defaults.limit || 20;
  const maxLimit = defaults.maxLimit || 100;
  
  const safePage = Math.max(1, Math.floor(Number(page) || 1));
  const safeLimit = Math.min(maxLimit, Math.max(1, Math.floor(Number(limit) || defaultLimit)));
  
  return {
    page: safePage,
    limit: safeLimit,
    offset: (safePage - 1) * safeLimit
  };
}

// 使用方式
const { page, limit, offset } = sanitizePagination(filters.page, filters.limit);
```

---

### 2.2 JSON 解析辅助函数 🔴

**问题**: 多个 Repository 都有私有 `_parseJson` 方法实现类似功能。

**重复位置**:
```
services/PurchaseOrderService.js:381-383
repositories/PurchaseOrderRepository.js:401-403
repositories/ProductVariantRepository.js:93,99,108,173
repositories/ProductRepository.js:342-344
repositories/order/helpers.js:13-19 (已有独立实现)
```

**重复代码示例**:
```javascript
// 多个文件重复定义
_parseJson(str) {
  try {
    return typeof str === 'string' ? JSON.parse(str) : (str || []);
  } catch {
    return [];
  }
}
```

**建议抽取方案**:
```javascript
// functions/lib/db/json-helpers.js
export function safeJsonParse(str, defaultValue = null) {
  if (str === null || str === undefined) return defaultValue;
  if (typeof str !== 'string') return str;
  try {
    return JSON.parse(str);
  } catch {
    return defaultValue;
  }
}

// 常用快捷方式
export const parseJsonArray = (str) => safeJsonParse(str, []);
export const parseJsonObject = (str) => safeJsonParse(str, {});
```

---

## 三、中优先级重复模式

### 3.1 时间戳获取模式 🟠

**问题**: `Date.now()` 和 `now()` 函数混用，且缺乏统一的时间戳处理。

**重复位置**: 130处调用，分布在25个文件中

**当前状态**:
- 已有 `api/utils/id.js` 中的 `now()` 函数
- 但很多地方仍直接使用 `Date.now()`

**建议抽取方案**:
```javascript
// functions/lib/db/timestamp.js
import { now } from '../api/utils/id.js';

// 统一时间戳获取入口
export { now };

// 扩展：带时区的时间戳工具
export function nowInSeconds() {
  return Math.floor(Date.now() / 1000);
}

export function nowInChina() {
  // 中国时区相关处理
}
```

---

### 3.2 COUNT 查询模式 🟠

**问题**: 大量重复的 `SELECT COUNT(*) as total/count` 查询。

**重复位置**: 44处

**重复代码示例**:
```javascript
// 多个 Repository 中类似的代码
const countResult = await this.db
  .prepare(`SELECT COUNT(*) as total FROM table_name WHERE ${where}`)
  .bind(...params)
  .first();
const total = countResult?.total || 0;
```

**建议抽取方案**:
```javascript
// functions/lib/db/query-helpers.js
export async function countQuery(db, table, whereClause = '1=1', bindings = []) {
  const result = await db
    .prepare(`SELECT COUNT(*) as total FROM ${table} WHERE ${whereClause}`)
    .bind(...bindings)
    .first();
  return result?.total || 0;
}
```

---

### 3.3 SQL SET 子句构建 🟠

**问题**: 动态构建 SQL UPDATE SET 子句的重复模式。

**重复位置**:
```
repositories/ProductRepository.js:230
repositories/FileRepository.js:168
repositories/PurchaseOrderRepository.js:181
```

**重复代码示例**:
```javascript
const sets = Object.keys(updateData).map(k => `${k} = ?`).join(', ');
// 或
const setClause = safeKeys.map(k => `${k} = ?`).join(', ');
```

**建议抽取方案**:
```javascript
// functions/lib/db/query-helpers.js
export function buildSetClause(data, allowedFields = null) {
  const keys = allowedFields 
    ? Object.keys(data).filter(k => allowedFields.includes(k))
    : Object.keys(data);
  
  if (keys.length === 0) return null;
  
  return {
    clause: keys.map(k => `${k} = ?`).join(', '),
    values: keys.map(k => data[k]),
    keys
  };
}
```

---

### 3.4 空间查询中的重复 SELECT 片段 🟠

**问题**: `SpaceRepository.js` 中多个方法有大量重复的 SELECT 子句。

**重复位置**: `repositories/SpaceRepository.js` 中 6 个方法包含相同的 SELECT 片段

**重复代码示例**:
```javascript
// 以下片段在多个方法中重复出现
p.spu as p_sku, p.brand as p_brand, p.series as p_series, 
COALESCE(pv.price, (SELECT MIN(price) FROM product_variants WHERE product_id = p.id), 0) as p_price, 
p.specifications as p_specs, p.images as p_images,
pv.sku as pv_sku, pv.price as pv_price,
(
  SELECT vi.image_id
  FROM variant_images vi
  WHERE vi.variant_id = s.variant_id AND vi.is_primary = 1
  ORDER BY vi.sort_order ASC, vi.created_at ASC
  LIMIT 1
) as variant_primary_image_id,
COALESCE(
  (SELECT vi.image_id FROM variant_images vi WHERE vi.variant_id = s.variant_id AND vi.is_primary = 1 ORDER BY vi.sort_order ASC, vi.created_at ASC LIMIT 1),
  pv.image_id,
  json_extract(p.images, '$[0]')
) as display_image_id
```

**建议抽取方案**:
```javascript
// functions/lib/db/sql-fragments.js
export const SPACE_PRODUCT_SELECT = `
  p.spu as p_sku, p.brand as p_brand, p.series as p_series,
  COALESCE(pv.price, (SELECT MIN(price) FROM product_variants WHERE product_id = p.id), 0) as p_price,
  p.specifications as p_specs, p.images as p_images,
  pv.sku as pv_sku, pv.price as pv_price
`;

export const SPACE_VARIANT_IMAGE_SELECT = `
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

// 使用方式
const sql = `
  SELECT s.*, ${SPACE_PRODUCT_SELECT}, ${SPACE_VARIANT_IMAGE_SELECT}
  FROM spaces s
  LEFT JOIN products p ON s.product_id = p.id
  LEFT JOIN product_variants pv ON s.variant_id = pv.id
`;
```

---

## 四、低优先级重复模式

### 4.1 UUID 生成调用 🟡

**问题**: `crypto.randomUUID()` 直接调用 vs 使用 `generateId()` 函数不一致。

**现状**: 已有 `api/utils/id.js` 中的 `generateId()` 封装，但仍有 5 处直接使用 `crypto.randomUUID()`。

**建议**: 统一使用 `generateId()` 函数，便于未来可能的 ID 格式变更。

---

### 4.2 result.meta?.changes 检查 🟡

**问题**: 检查 D1 操作影响的行数有微小的变化模式。

**重复位置**:
```
repositories/PurchaseOrderRepository.js:189,206,270,294
repositories/ProductVariantRepository.js:210,235
repositories/ProductRepository.js:240,278
lib/hono/routes/manage/products/[id].js:685
```

**重复代码示例**:
```javascript
return result.meta?.changes > 0;
// 或
return (result.meta?.changes || 0) > 0;
```

**建议抽取方案**:
```javascript
// functions/lib/db/result-helpers.js
export function hasChanges(result) {
  return (result.meta?.changes || 0) > 0;
}

export function getChangesCount(result) {
  return result.meta?.changes || 0;
}
```

---

## 五、建议的重构架构

### 5.1 新建共享模块结构

```
functions/lib/db/
├── index.js              # 统一导出
├── pagination.js         # 分页工具
├── json-helpers.js       # JSON 解析工具
├── query-helpers.js      # 查询构建工具
├── result-helpers.js     # 结果处理工具
├── sql-fragments.js      # SQL 片段常量
└── timestamp.js          # 时间戳工具
```

### 5.2 Repository 基类

考虑创建 `BaseRepository` 基类：

```javascript
// functions/lib/db/BaseRepository.js
import { sanitizePagination } from './pagination.js';
import { safeJsonParse, parseJsonArray, parseJsonObject } from './json-helpers.js';
import { now } from './timestamp.js';
import { hasChanges } from './result-helpers.js';

export class BaseRepository {
  constructor(db) {
    this.db = db;
  }

  // 分页工具
  getPagination(page, limit, defaults) {
    return sanitizePagination(page, limit, defaults);
  }

  // JSON 解析
  parseJson(str, defaultValue = null) {
    return safeJsonParse(str, defaultValue);
  }

  parseJsonArray(str) {
    return parseJsonArray(str);
  }

  parseJsonObject(str) {
    return parseJsonObject(str);
  }

  // 时间戳
  get now() {
    return now();
  }

  // 结果检查
  hasChanges(result) {
    return hasChanges(result);
  }
}
```

---

## 六、重构优先级建议

### 第一阶段 (立即执行)
1. ✅ 创建 `pagination.js` 并迁移所有分页验证逻辑
2. ✅ 创建 `json-helpers.js` 并统一 JSON 解析

### 第二阶段 (短期)
3. ✅ 创建 `query-helpers.js` 提取 SET 子句构建
4. ✅ 创建 `result-helpers.js` 统一结果处理
5. ✅ 重构 `SpaceRepository.js` 使用 SQL 片段常量

### 第三阶段 (中期)
6. ✅ 创建 `BaseRepository` 基类
7. ✅ 统一 `Date.now()` 为 `now()` 调用
8. ✅ 统一 `crypto.randomUUID()` 为 `generateId()` 调用

---

## 七、预期收益

| 指标 | 当前状态 | 重构后 | 改进 |
|------|----------|--------|------|
| 重复代码行数 | ~600行 | ~100行 | -500行 |
| 维护成本 | 高（修改需同步多处） | 低（单点修改） | -80% |
| 一致性 | 差（多种实现方式） | 好（统一接口） | +100% |
| 测试覆盖 | 分散 | 集中 | 更易测试 |

---

## 八、注意事项

1. **向后兼容**: 重构时保留原有方法的别名，逐步迁移
2. **测试覆盖**: 确保新的共享模块有完整的单元测试
3. **文档更新**: 更新相关 API 文档和代码注释
4. **渐进式重构**: 不建议一次性大规模重构，分阶段进行

---

**审查人**: AI Code Reviewer
**报告生成时间**: 2026-03-03