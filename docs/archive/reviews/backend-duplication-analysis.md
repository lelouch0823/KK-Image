# 后端代码重复定义审查报告

**审查日期**: 2026-03-03
**审查范围**: `functions/` 目录

---

## 一、问题概览

| 优先级 | 重复模式                | 出现次数 | 涉及文件数 | 可减少代码量 |
| ------ | ----------------------- | -------- | ---------- | ------------ |
| 🔴 高  | 分页参数验证            | 48处     | 8个文件    | ~200行       |
| 🔴 高  | JSON 解析函数           | 19处     | 6个文件    | ~80行        |
| 🔴 高  | SpaceRepository SQL片段 | 6处      | 1个文件    | ~150行       |
| 🟠 中  | 时间戳获取              | 130处    | 25个文件   | ~100行       |
| 🟠 中  | COUNT查询               | 44处     | 15个文件   | ~50行        |
| 🟠 中  | SQL SET构建             | 3处      | 3个文件    | ~30行        |
| 🟡 低  | UUID生成                | 10处     | 5个文件    | ~20行        |
| 🟡 低  | result.meta检查         | 9处      | 4个文件    | ~20行        |

**总计**: 约 **550行** 重复代码

---

## 二、高优先级问题

### 2.1 分页参数验证 (48处)

**重复代码**:

```javascript
const safePage = Math.max(1, Math.floor(Number(page) || 1));
const safeLimit = Math.min(100, Math.max(1, Math.floor(Number(limit) || 20)));
const offset = (safePage - 1) * safeLimit;
```

**涉及文件**:

- `repositories/FileRepository.js:121-122`
- `repositories/FolderRepository.js:250-252`
- `repositories/CustomerRepository.js:52-54`
- `repositories/SalespersonRepository.js:81-83`
- `repositories/ProductRepository.js:287-288`
- `repositories/PurchaseOrderRepository.js:117-118`
- `repositories/ProductVariantRepository.js:112`
- `repositories/order/queries.js:91-93, 160-162`

**建议方案**:
扩展现有 `parsePagination` (位于 `lib/hono/_shared/route-helpers.js`)，让 Repository 层也能复用。

---

### 2.2 JSON 解析函数 (19处)

**重复代码**:

```javascript
_parseJson(str) {
  try {
    return typeof str === 'string' ? JSON.parse(str) : (str || []);
  } catch {
    return [];
  }
}
```

**涉及文件**:

- `repositories/PurchaseOrderRepository.js:401-403` - 方法定义
- `services/PurchaseOrderService.js:381-383` - 方法定义
- `repositories/ProductVariantRepository.js:93,99,108,173` - 内联
- `repositories/ProductRepository.js:342-344` - 内联
- `lib/hono/routes/manage/products/index.js:69` - 局部函数

**已有参考**: `repositories/order/helpers.js` 中的 `parseJson()`

**建议方案**:
创建统一的 `safeJsonParse()` 工具函数，在 `_shared/utils.js` 中导出。

---

### 2.3 SpaceRepository SQL片段 (6处)

**问题**: 以下复杂 SQL 在 6 个方法中完全重复:

```sql
p.spu as p_sku, p.brand as p_brand, p.series as p_series,
COALESCE(pv.price, ...) as p_price,
(SELECT vi.image_id FROM variant_images vi WHERE ...) as variant_primary_image_id,
COALESCE(...) as display_image_id
```

**涉及方法**:

- `findAll()`
- `findById()`
- `findByProductId()`
- `findSubspaces()`
- `findAllForSalesperson()`
- `findByIdForSalesperson()`

**建议方案**:
抽取为私有方法 `_spaceProductSelect()` 和 `_variantImageSelect()`。

---

## 三、中优先级问题

### 3.1 时间戳获取 (130处)

**现状**:

- `Date.now()` 直接调用: ~80处
- `now()` 函数调用: ~40处 (来自 `api/utils/id.js`)
- 混用于同一文件

**建议**: 统一使用 `now()` 函数

---

### 3.2 COUNT查询 (44处)

**典型模式**:

```javascript
const result = await db
  .prepare(`SELECT COUNT(*) as total FROM table WHERE ${where}`)
  .bind(...params)
  .first();
const total = result?.total || 0;
```

**建议**: 优先级较低，各查询条件不同，抽取收益有限

---

### 3.3 SQL SET构建 (3处)

**重复代码**:

```javascript
const sets = Object.keys(updateData)
  .map((k) => `${k} = ?`)
  .join(', ');
```

**涉及文件**:

- `repositories/ProductRepository.js:230`
- `repositories/FileRepository.js:168`
- `repositories/PurchaseOrderRepository.js:181`

**建议**: 扩展 `api/utils/sql.js`，添加 `buildSetClause()` 函数

---

## 四、低优先级问题

### 4.1 UUID生成不一致

**问题**: 部分代码直接用 `crypto.randomUUID()`，部分用 `generateId()`

**涉及文件**:

- `api/cron/reminders.js:46,102,125`
- `repositories/PurchaseOrderRepository.js:51,230`
- `repositories/CustomerRepository.js:125`
- `repositories/ProductRepository.js:56,111`

**建议**: 统一使用 `generateId()`

---

### 4.2 result.meta?.changes 检查

**重复模式**:

```javascript
return result.meta?.changes > 0;
return (result.meta?.changes || 0) > 0;
```

**建议**: 创建 `hasChanges(result)` 工具函数

---

## 五、推荐实施顺序

| 阶段 | 任务                        | 预估工作量 |
| ---- | --------------------------- | ---------- |
| 1    | 扩展 parsePagination + 迁移 | 1天        |
| 2    | 创建 safeJsonParse + 迁移   | 0.5天      |
| 3    | 重构 SpaceRepository SQL    | 0.5天      |
| 4    | 扩展 SQL 工具 + 统一 UUID   | 0.5天      |

---

## 六、现有良好实践

| 文件                                | 内容                       |
| ----------------------------------- | -------------------------- |
| `_shared/utils.js`                  | Barrel File 集中导出       |
| `api/utils/sql.js`                  | `inClause`, `placeholders` |
| `api/utils/id.js`                   | `generateId`, `now`        |
| `lib/hono/_shared/route-helpers.js` | `parsePagination`          |
| `repositories/order/helpers.js`     | `parseJson`, 数据映射函数  |
