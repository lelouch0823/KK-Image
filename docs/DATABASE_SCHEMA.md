# Database Schema (SOTA)

> **Last Updated**: 2026-01-27
> **Database Engine**: Cloudflare D1 (SQLite)

本文档描述 **kk-life** 的核心数据库结构。所有表结构定义源自 `scripts/init-database.sql`。

## 1. 核心文件系统 (Core File System)

### `folders` (文件夹)
支持无限层级嵌套的文件目录结构。
| Column | Type | Description |
|--------|------|-------------|
| `id` | TEXT | PK, UUID/NanoID |
| `parent_id` | TEXT | FK -> folders.id (Null for root) |
| `name` | TEXT | 文件夹名称 |
| `is_public` | INTEGER | 0/1 是否公开 |

### `files` (文件元数据)
存储文件的业务元数据，通过 `storage_key` 关联 R2 对象，通过 `content_hash` 关联物理存储 blob（去重）。
| Column | Type | Description |
|--------|------|-------------|
| `id` | TEXT | PK |
| `folder_id` | TEXT | FK -> folders.id |
| `name` | TEXT | 显示文件名 |
| `storage_key`| TEXT | R2 中的 Key |
| `content_hash`| TEXT | SHA-256 哈希 (用于 CAS 去重) |
| `size` | INTEGER | 字节大小 |
| `mime_type` | TEXT | e.g. image/jpeg |

### `blobs` (物理存储/CAS)
内容寻址存储表，实现文件去重。
| Column | Type | Description |
|--------|------|-------------|
| `content_hash`| TEXT | PK, SHA-256 |
| `ref_count` | INTEGER | 引用计数 |

| `created_at` | INTEGER | 创建时间 |
| `updated_at` | INTEGER | 更新时间 (Added in v2) |
| `created_by` | TEXT | 创建人ID (Added in migration 0006) |
| `width` | INTEGER | 宽 (px) |
| `height` | INTEGER | 高 (px) |
| `blurhash` | TEXT | 模糊占位符 |


### `blobs` (物理存储/CAS)

内容寻址存储表，实现文件去重。

| Column | Type | Description |
| --- | --- | --- |
| `content_hash` | TEXT | PK, SHA-256 |
| `ref_count` | INTEGER | 引用计数 |
| `size` | INTEGER | 文件大小 |
| `mime_type` | TEXT | 媒体类型 |
| `created_at` | INTEGER | 创建时间 |

### `albums` (虚拟相册) (SOTA Feature)
支持多文件逻辑分组的虚拟相册，不改变物理文件结构。

| Column | Type | Description |
| --- | --- | --- |
| `id` | TEXT | PK |
| `name` | TEXT | 相册名称 |
| `share_token`| TEXT | 分享 Token |
| `is_public` | INTEGER | 0/1 |
| `cover_file_id`| TEXT | FK -> files.id |

---

## 2. 共享空间 (Shared Spaces)

### `spaces`
类似于网盘分享链接的逻辑实体，支持多种视图模板。
| Column | Type | Description |
|--------|------|-------------|
| `id` | TEXT | PK |
| `share_token`| TEXT | Unique, 用于公开访问 URL |
| `template` | TEXT | `gallery`, `product`, `portfolio` 等 |
| `template_data`| TEXT | JSON, 存储 SKU、价格等扩展字段 |
| `password` | TEXT | 访问密码 (明文/简单哈希) |
| `expires_at` | INTEGER | 过期时间戳 |
| `share_mode` | TEXT | `all` (公开) / `sales` (指定销售) |

### `space_files` (关联表)
多对多关联 Space 和 Files。

### `space_salesperson_shares` (空间-销售员关联表)
当 `share_mode = 'sales'` 时，记录有权限访问该空间的销售员。
| Column | Type | Description |
|--------|------|-------------|
| `space_id` | TEXT | PK, FK -> spaces.id |
| `salesperson_id` | TEXT | PK, FK -> salespersons.id |
| `shared_at` | INTEGER | 授权时间 |

---

## 3. 订单与 CRM 系统 (Order & CRM)

### `salespersons` (销售人员)
独立的销售端账户体系，基于 Access Token 登录。
| Column | Type | Description |
|--------|------|-------------|
| `id` | TEXT | PK |
| `name` | TEXT | 销售姓名 |
| `access_token`| TEXT | 登录凭证 (Unique) |
| `store` | TEXT | 所属门店/区域 |
| `wechat_openid`| TEXT | 微信小程序 OpenID (Unique) |

### `customers` (客户)
简易 CRM 客户档案。
| Column | Type | Description |
|--------|------|-------------|
| `id` | TEXT | PK |
| `name` | TEXT | 客户姓名 |
| `phone` | TEXT | 联系电话 |
| `tags` | TEXT | JSON Array |

### `orders` (订单)
核心业务表。
| Column | Type | Description |
|--------|------|-------------|
| `id` | TEXT | PK |
| `order_no` | TEXT | 唯一订单号 (ORD-Date-Seq) |
| `salesperson_id`| TEXT | FK |
| `customer_id`| TEXT | FK |
| `status` | TEXT | `pending`, `confirmed`, `rejected`, `production`, `shipping`, `arrived`, `delivered`, `void` |
| `procurement_status` | TEXT | `none`, `planned`, `ordered`, `partially_arrived`, `arrived` |
| `original_data` | TEXT | JSON, 原始提交数据 (不可变) |
| `current_data` | TEXT | JSON, 当前有效数据 |
| `unread_by_admin`| INT | 1 = 管理员未读 |
| `product_id` | TEXT | FK -> products.id |
| `quantity` | INTEGER | 订单数量 (Default 1) |

### `order_timeline` (时间轴)
记录订单的所有操作日志。
| Column | Type | Description |
|--------|------|-------------|
| `action_type` | TEXT | `created`, `field_updated`, `status_changed`, `comment` |
| `actor_type` | TEXT | `salesperson` / `admin` |
| `old_value` / `new_value` | TEXT | 变更前后的值 |

---

## 4. 商品与库存系统 (Product & Inventory) - [SOTA]

### `products` (商品 SPU)
核心商品信息，不包含业务字段（如价格、库存）。
| Column | Type | Description |
|--------|------|-------------|
| `id` | TEXT | PK |
| `name` | TEXT | 商品名称 |
| `spu` | TEXT | 唯一 SPU 编码 |
| `product_code` | TEXT | 自动生成的商品短码 |
| `category` / `brand` / `series` | TEXT | 分类与品牌信息 |
| `images` | TEXT | JSON Array of files.id |
| `specifications` | TEXT | JSON, 商品基础规格属性 |
| `options` | TEXT | JSON, 变体选项定义 (如 `["Color", "Size"]`) |

### `product_variants` (商品变体 SKU)
挂载价格、库存等核心业务信息。
| Column | Type | Description |
|--------|------|-------------|
| `id` | TEXT | PK |
| `product_id` | TEXT | FK -> products.id |
| `sku` | TEXT | 唯一 SKU 编码 |
| `price` / `cost_price` | REAL | 售价与成本价 |
| `stock_quantity` | INTEGER | 冗余的库存数量（以 inventory_balances 为准）|
| `options_values` | TEXT | JSON, 对应 options 的实际值 (如 `{"Color": "Red"}`) |
| `variant_signature` | TEXT | 签名去重字段 |
| `image_id` | TEXT | FK -> files.id (变体专属图片) |
| `status` | TEXT | `active`, `archived` |

### `product_dimensions` & `product_dimension_values` & `aliases`
商品级的多维规格与值映射，支持变体维度的可扩展性。

### `inventory_ledger` & `inventory_balances` (库存分类账)
采用分类账模型记录所有库存变动。
| Column | Type | Description |
|--------|------|-------------|
| `id` / `variant_id` | TEXT | PK / FK -> product_variants.id |
| `event_type` | TEXT | `purchase_in`, `sales_out`, `manual_adjustment` 等 |
| `quantity_delta` | INTEGER | 变动数量 (+/-) |
| `reference_type` / `reference_id` | TEXT | 关联单据 (如 `purchase_order`) |

*balances 表记录实时结存 (on_hand, reserved, available)。*

### `purchase_orders` & `purchase_order_items` (采购单)
支持多商品合并采购、运费关税分摊。
| Column | Type | Description |
|--------|------|-------------|
| `id` | TEXT | PK |
| `po_no` | TEXT | 唯一采购单号 |
| `status` | TEXT | `draft`, `ordered`, `shipping`, `arrived`, `completed`, `cancelled` |
| `actual_shipping_cost` | REAL | 运费 |
| `allocation_method` | TEXT | 分摊方式 (`by_quantity`, `by_value`) |

---

## 5. 系统模块

### `users` (管理员)
后台通过用户名/密码登录。

### `notifications` (通知)
站内消息通知。
| Column | Type | Description |
|--------|------|-------------|
| `type` | TEXT | `system`, `order`, `deadline` |
| `is_read` | INTEGER | 0/1 |

### `webhooks` & `webhook_logs`
外部系统集成回调配置及日志。

### `ai_action_sessions` (AI 动作会话)
AI 创建事务的短期状态存储，用于在多轮追问、预览和确认之间恢复上下文。
| Column | Type | Description |
|--------|------|-------------|
| `id` | TEXT | PK |
| `user_id` | TEXT | 发起动作的后台用户 ID |
| `action_type` | TEXT | 如 `create_order` |
| `entity_type` | TEXT | 如 `order`, `customer` |
| `status` | TEXT | `collecting`, `awaiting_confirmation`, `completed`, `cancelled` |
| `slots_json` | TEXT | JSON, 已收集字段 |
| `preview_json` | TEXT | JSON, 预览数据 |
| `expires_at` | INTEGER | 过期时间戳 |
| `created_at` | INTEGER | 创建时间 |
| `updated_at` | INTEGER | 更新时间 |

---

## ER Diagram (Simplified)

```mermaid
erDiagram
    FOLDERS ||--o{ FILES : contains
    FILES }o--|| BLOBS : refers_to
    
    SPACES }o--o{ FILES : highlights
    
    PRODUCTS ||--o{ PRODUCT_VARIANTS : has
    PRODUCT_VARIANTS ||--o{ INVENTORY_LEDGER : tracks
    
    PURCHASE_ORDERS ||--o{ PURCHASE_ORDER_ITEMS : contains
    PURCHASE_ORDER_ITEMS }o--|| PRODUCTS : buys
    
    SALESPERSONS ||--o{ ORDERS : submits
    CUSTOMERS ||--o{ ORDERS : owns
    ORDERS ||--o{ ORDER_TIMELINE : logs
    ORDERS }o--o{ FILES : attachments
    ORDERS }o--|| PRODUCT_VARIANTS : contains
```
