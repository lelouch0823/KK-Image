# KK-Image Repository 层设计文档

## 1. 模块概述

### 1.1 整体架构

```
┌─────────────────────────────────────────────────────────────────┐
│                        API Layer (Hono Routes)                  │
└─────────────────────────────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Service Layer                              │
└─────────────────────────────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Repository Layer                             │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐            │
│  │FileRepository│ │OrderRepository│ │ProductRepo  │ ...        │
│  └──────────────┘ └──────────────┘ └──────────────┘            │
└─────────────────────────────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────┐
│                    D1 Database (SQLite)                         │
└─────────────────────────────────────────────────────────────────┘
```

### 1.2 设计理念

**Repository Pattern (仓储模式)**:
- 将数据访问逻辑与业务逻辑分离
- 封装所有数据库操作，提供清晰的 API
- 支持单元测试和依赖注入

**核心设计原则**:
1. **单一职责**: 每个 Repository 只负责一个数据实体
2. **依赖注入**: 通过构造函数注入 `D1Database` 实例
3. **SQL 注入防护**: 使用参数化查询 (`prepare().bind()`)
4. **批量优化**: 使用 `D1 batch` 进行批量操作
5. **软删除支持**: 关键实体支持回收站功能

---

## 2. Repository 清单

| Repository | 文件 | 职责描述 | 对应数据表 |
|------------|------|----------|-----------|
| FileRepository | `FileRepository.js` | 文件记录的 CRUD、回收站 | `files` |
| FolderRepository | `FolderRepository.js` | 文件夹层级管理 | `folders` |
| OrderRepository | `OrderRepository.js` | 订单操作门面 | `orders`, `order_files`, `order_timeline` |
| OrderStatsRepository | `OrderStatsRepository.js` | 订单统计查询 | `orders` |
| ProductRepository | `ProductRepository.js` | 商品主表 CRUD | `products` |
| ProductVariantRepository | `ProductVariantRepository.js` | 商品变体管理 | `product_variants` |
| CustomerRepository | `CustomerRepository.js` | 客户信息管理 | `customers` |
| SalespersonRepository | `SalespersonRepository.js` | 销售人员管理 | `salespersons` |
| SpaceRepository | `SpaceRepository.js` | 共享空间 | `spaces`, `space_files` |
| PurchaseOrderRepository | `PurchaseOrderRepository.js` | 采购单管理 | `purchase_orders` |
| NotificationRepository | `NotificationRepository.js` | 通知系统 | `notifications` |
| StatsRepository | `StatsRepository.js` | 系统统计 | 多表聚合 |

---

## 3. 核心 Repository 详解

### 3.1 FileRepository

**文件路径**: `functions/repositories/FileRepository.js`

#### 核心功能

| 方法 | 功能描述 |
|------|---------|
| `findByFolder(folderId)` | 获取文件夹下文件列表 |
| `create(data)` | 创建单条文件记录 |
| `createBatch(items)` | 批量创建文件记录 |
| `findById(id)` | 根据 ID 获取文件详情 |
| `findByOriginalHash(hash)` | 根据哈希查询（秒传） |
| `update(id, updates)` | 更新文件信息 |
| `softDelete(id)` | 软删除（移入回收站） |
| `restoreBatch(ids)` | 批量还原 |
| `findTrashWithPaths()` | 获取回收站文件（带路径） |

#### 关键实现

```javascript
// 白名单防护 - 防止 SQL 注入
const ALLOWED_UPDATE_COLUMNS = new Set([
    'name', 'original_name', 'folder_id', 'storage_key',
    'size', 'mime_type', 'content_hash', 'original_hash'
]);

// 回收站路径查询 - 使用 CTE
async findTrashWithPaths() {
    const { results } = await this.db.prepare(`
        WITH RECURSIVE folder_paths(id, path) AS (
            SELECT id, name FROM folders WHERE parent_id IS NULL
            UNION ALL
            SELECT f.id, fp.path || '/' || f.name
            FROM folders f JOIN folder_paths fp ON f.parent_id = fp.id
        )
        SELECT f.*, COALESCE('/' || fp.path, '/') as original_path
        FROM files f
        LEFT JOIN folder_paths fp ON f.folder_id = fp.id
        WHERE f.is_deleted = 1
    `).all();
}
```

---

### 3.2 OrderRepository

**文件路径**: `functions/repositories/OrderRepository.js`

#### 架构设计 - Facade Pattern

```
OrderRepository (Facade)
    │
    ├── queries.js (查询操作)
    │      ├── findById()
    │      ├── listBySalesperson()
    │      └── listForAdmin()
    │
    ├── mutations.js (变更操作)
    │      ├── create()
    │      ├── updateStatus()
    │      └── batchUpdateStatus()
    │
    └── helpers.js (数据映射)
           ├── parseJson()
           └── mapOrderDetail()
```

#### 订单状态排序

```javascript
// 智能排序 - 待处理优先
ORDER BY
    o.unread_by_admin DESC,    -- 未读优先
    CASE o.status
        WHEN 'pending' THEN 1
        WHEN 'production' THEN 2
        WHEN 'shipping' THEN 3
        ELSE 50
    END ASC,
    o.created_at DESC
```

---

### 3.3 ProductRepository

**文件路径**: `functions/repositories/ProductRepository.js`

#### CTE 聚合查询

```javascript
_variantAggregateCTE() {
    return `
        WITH variant_agg AS (
            SELECT product_id,
                   MIN(price) AS min_price,
                   SUM(stock_quantity) AS total_stock_quantity
            FROM product_variants
            GROUP BY product_id
        )
    `;
}
```

#### 货币验证

```javascript
static PRODUCT_CURRENCY_SET = new Set(['CNY', 'USD', 'EUR', 'GBP', 'JPY']);

normalizeCurrency(value) {
    const normalized = String(value ?? '').trim().toUpperCase();
    return PRODUCT_CURRENCY_SET.has(normalized) ? normalized : 'CNY';
}
```

---

### 3.4 SpaceRepository

**文件路径**: `functions/repositories/SpaceRepository.js`

#### 复杂关联查询

```javascript
async findAll() {
    // 关联 files, products, product_variants
    // 计算文件数量、封面图、产品信息
    SELECT s.*,
        COALESCE(sf_count.file_count, 0) as file_count,
        f.storage_key as cover_storage_key,
        p.spu as p_sku, p.brand as p_brand
    FROM spaces s
    LEFT JOIN (...) sf_count ON sf_count.space_id = s.id
    LEFT JOIN files f ON s.cover_file_id = f.id
    LEFT JOIN products p ON s.product_id = p.id
}
```

#### 销售员权限控制

```javascript
async findByIdForSalesperson(spaceId, salespersonId) {
    // 检查 share_mode = 'all' 或 销售员在分享列表中
    WHERE s.id = ?
      AND (s.share_mode = 'all'
           OR EXISTS (SELECT 1 FROM space_salesperson_shares 
                      WHERE space_id = s.id AND salesperson_id = ?))
}
```

---

### 3.5 SalespersonRepository

**文件路径**: `functions/repositories/SalespersonRepository.js`

#### 核心功能

```javascript
// 创建销售人员（带重试机制）
async create({ name, store, phone, password }) {
    const accessToken = generateShareToken(12);
    const passwordHash = await hashPassword(password, this.jwtSecret);
    // 重试机制处理 token 冲突
}

// 微信 OpenID 绑定
async findByWechatOpenid(openid) { ... }

// 登录记录
async recordLogin(id, ip, device) { ... }
```

---

## 4. 数据访问模式

### 4.1 CRUD 操作实现

| 操作 | 模式 |
|------|------|
| 单条创建 | `prepare(INSERT).bind(...).run()` |
| 批量创建 | `db.batch([stmt1, stmt2, ...])` |
| UPSERT | `INSERT ... ON CONFLICT(id) DO UPDATE SET ...` |
| 单条查询 | `prepare(SELECT).bind(...).first()` |
| 列表查询 | `prepare(SELECT).bind(...).all()` |
| 分页查询 | `LIMIT ? OFFSET ?` 配合 `COUNT(*)` |
| 软删除 | `UPDATE SET is_deleted = 1, deleted_at = ?` |

### 4.2 分页模式

```javascript
async findAll(filter = {}, { page = 1, limit = 50 } = {}) {
    // 1. 参数验证
    const safePage = Math.max(1, Math.floor(Number(page) || 1));
    const safeLimit = Math.min(100, Math.max(1, Math.floor(Number(limit) || 50)));
    
    // 2. 并行查询总数和列表
    const [countResult, listResult] = await Promise.all([
        this.db.prepare(countSql).bind(...bindings).first(),
        this.db.prepare(listSql).bind(...bindings, limit, offset).all(),
    ]);

    // 3. 返回分页结果
    return { items, total, page, limit, totalPages };
}
```

---

## 5. 事务处理

### 5.1 D1 Batch 事务

```javascript
// 批量操作 - 原子性保证
async deleteRecursive(folderId) {
    // 获取所有后代文件夹 ID (CTE)
    const ids = await getDescendantIds(folderId);
    
    // 批量删除 - 同一事务
    await this.db.batch([
        this.db.prepare(`DELETE FROM files WHERE folder_id IN (...)`).bind(...ids),
        this.db.prepare(`DELETE FROM folders WHERE id IN (...)`).bind(...ids)
    ]);
}
```

### 5.2 订单创建事务

```javascript
export async function create(db, timelineRepo, data) {
    const batchStatements = [];

    // 1. 插入订单
    batchStatements.push(db.prepare(`INSERT INTO orders ...`).bind(...));

    // 2. 关联文件
    fileIds.forEach(fileId => {
        batchStatements.push(db.prepare(`INSERT INTO order_files ...`).bind(...));
    });

    // 3. 记录时间轴
    batchStatements.push(timelineRepo.createInsertStatement(...));

    // 原子执行
    await db.batch(batchStatements);
}
```

---

## 6. Repository 与数据库表映射

```
FileRepository          → files, blobs
FolderRepository        → folders
OrderRepository         → orders, order_files, order_timeline
ProductRepository       → products
ProductVariantRepository → product_variants
CustomerRepository      → customers
SalespersonRepository   → salespersons
SpaceRepository         → spaces, space_files, space_salesperson_shares
PurchaseOrderRepository → purchase_orders, purchase_order_items
NotificationRepository  → notifications
```

---

## 7. 最佳实践

### 7.1 安全性

```javascript
// 始终使用参数化查询
this.db.prepare('SELECT * FROM files WHERE id = ?').bind(id).first();

// 白名单列名防护
const ALLOWED_COLUMNS = new Set(['name', 'status', 'tags']);
const safeKeys = Object.keys(updates).filter(k => ALLOWED_COLUMNS.has(k));
```

### 7.2 性能优化

```javascript
// 并行查询
const [count, list] = await Promise.all([countQuery, listQuery]);

// 批量操作替代循环
const statements = items.map(item => this.db.prepare(INSERT).bind(...item));
await this.db.batch(statements);

// 使用 CTE 替代多次查询
WITH RECURSIVE descendants AS (...) SELECT * FROM descendants;
```

### 7.3 命名规范

| 场景 | 命名模式 | 示例 |
|------|---------|------|
| 单条查询 | `findById`, `findByXxx` | `findById`, `findByToken` |
| 列表查询 | `list`, `listByXxx` | `listBySalesperson` |
| 分页查询 | `findAll` | `findAll(filter, pagination)` |
| 创建 | `create`, `createBatch` | `createBatch` |
| 更新 | `update`, `updateXxx` | `updateStatus` |
| 删除 | `delete`, `softDelete` | `softDelete` |
| 统计 | `getStats` | `getAdminStats` |
| 检查 | `hasXxx`, `checkXxx` | `hasOrders` |
