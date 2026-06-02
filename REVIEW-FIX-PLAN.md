# 代码审查修复计划

> 基于 4 维度审查发现的 126 个问题，按优先级分批修复

## 第一批：安全严重问题（6 个）

### Fix-1: OAuth secret 哈希存储 + 常量时间比较
- `functions/repositories/OAuthRepository.js:41` - 创建时存储 SHA-256 哈希
- `functions/lib/hono/routes/manage/oauth.js:213` - 使用 `crypto.subtle.timingSafeEqual` 比较
- 影响：C2 + C3

### Fix-2: ERP webhook 签名验证
- `functions/services/ErpSyncService.js` - 添加 HMAC 签名验证
- `functions/lib/hono/routes/manage/erp-sync.js:129` - 修正注释
- 影响：C1

### Fix-3: 批量打印 XSS 转义
- `src/composables/order/useOrderBatch.ts:216` - HTML 转义所有插值
- 影响：前端 C1

### Fix-4: AutocompleteInput 正则修复
- `src/components/ui/AutocompleteInput.vue:152` - 使用 `escapedQuery` 替代 `escapeHtml(query)`
- 影响：前端 C2

### Fix-5: 迁移 0089 安全性
- `migrations/0089_product_status.sql` - 添加 IF NOT EXISTS 保护
- 影响：DB C1

### Fix-6: ReceivablesDashboard 数据绑定
- `src/components/ReceivablesDashboard.vue:16` - 修正字段绑定
- 影响：前端功能 bug

## 第二批：Zod 验证补充（7 个）

### Fix-7: OAuth 端点 Zod 验证
- `functions/lib/hono/routes/manage/oauth.js` - /revoke、/authorize、POST body
- 影响：H1 + H2

### Fix-8: Feature flags 端点 Zod 验证
- `functions/lib/hono/routes/manage/feature-flags.js` - PATCH /:key、POST /
- 影响：H3 + H4

### Fix-9: Settings 端点 Zod 验证
- `functions/lib/hono/routes/manage/settings.js` - POST /batch、PUT /:key
- 影响：H5 + H6

### Fix-10: Stocktakes schema .strict()
- `functions/lib/hono/routes/manage/stocktakes.js` - 添加 .strict()
- 影响：H7

### Fix-11: Customers batch 验证 + 限制
- `functions/lib/hono/routes/manage/customers.js` - batch/tags、batch/export
- 影响：H8 + H9

### Fix-12: N+1 查询修复
- `functions/lib/hono/routes/manage/customers.js` - findByIds 批量查询
- `functions/repositories/StocktakeRepository.js` - 批量获取 system_qty
- 影响：H10 + M6

### Fix-13: c.get('userId') 修复
- `functions/lib/hono/routes/manage/oauth.js:178` - 改为 c.get('user')?.id
- `functions/lib/hono/routes/manage/erp-sync.js:54` - 同上
- 影响：M7 + M8

## 第三批：数据库 CHECK 约束（8 个迁移修复）

### Fix-14: 补充 CHECK 约束
- 0087: customer_communications.type
- 0089: products.status（如果 ALTER 成功）
- 0090: price_rules.price_type + price >= 0
- 0091: stocktakes.status + stocktake_items.actual_qty >= 0
- 0092: payments.method + amount > 0
- 0094: erp_connections/erp_sync_logs/erp_entity_mappings 所有枚举列
- 影响：DB H1-H8

### Fix-15: 冗余索引清理
- 0086: 删除 idx_customer_tags_customer_id
- 0090: 删除 idx_price_rules_variant
- 0094: 删除 3 个 OAuth 冗余索引 + 2 个 ERP 映射冗余索引
- 影响：DB M-冗余索引

### Fix-16: DEFAULT 表达式补充
- 0086: customer_tags.created_at DEFAULT
- 0091: stocktakes/stocktake_items id + created_at DEFAULT
- 0094: 所有 ERP/OAuth 表 id + created_at DEFAULT
- 影响：DB M-DEFAULT

### Fix-17: FTS5 迁移幂等性
- 0085: 使用 `INSERT INTO products_fts(products_fts) VALUES('rebuild')` 替代
- 影响：DB H-FTS5

## 第四批：后端代码质量（6 个）

### Fix-18: 动态 SQL 改用 buildSetClause
- CategoryRepository.js:102
- ErpSyncRepository.js:53
- OAuthRepository.js:57
- 影响：M3 + M4 + M5

### Fix-19: ERP credentials 脱敏
- ErpSyncRepository.js:233 - 返回时 mask 凭据
- 影响：M11

### Fix-20: FTS5 缓存 TTL
- functions/lib/hono/routes/manage/search.js - 添加 TTL
- 影响：M1

### Fix-21: oauth refresh_token UNIQUE
- 新增迁移：ALTER TABLE 添加 UNIQUE 约束
- 影响：DB M-refresh_token

### Fix-22: TraceId fallback 改用 crypto.getRandomValues
- functions/lib/hono/middleware/traceId.js:15
- 影响：L1

### Fix-23: ErpSyncService 构造函数注入
- functions/services/ErpSyncService.js:10 - 注入缺失的 repo
- 影响：L6

## 第五批：前端安全与质量（10 个）

### Fix-24: API constants 类型安全
- src/utils/constants.ts - 改用 `as const`
- 影响：前端 H3

### Fix-25: useFormDraft JSON.stringify 优化
- src/composables/useFormDraft.ts - 使用 deep watch
- 影响：前端 H5

### Fix-26: useFormValidation timer 清理
- src/composables/useFormValidation.ts - 添加 onUnmounted
- 影响：前端 H7

### Fix-27: useRecentViews 响应式修复
- src/composables/useRecentViews.ts - 改用 ref
- 影响：前端 M14

### Fix-28: useKeyboardShortcuts useMagicKeys 模块级
- src/composables/useKeyboardShortcuts.ts - 移到模块级
- 影响：前端 H4

### Fix-29: ErpSync/OAuthApps 改用 Modal 组件
- src/views/ErpSync.vue - 重构模态框
- src/views/OAuthApps.vue - 重构模态框
- 影响：前端 M16 + M17

### Fix-30: StocktakeManager 改用 AppTable
- src/views/StocktakeManager.vue - 替换原生 table
- 影响：前端 M18

### Fix-31: CommandPalette 重复监听器
- src/components/ui/CommandPalette.vue - 移除重复 keydown
- 影响：前端 M9

### Fix-32: FeatureFlag 动态 prop 支持
- src/components/FeatureFlag.vue - 添加 watch
- 影响：前端 L26

### Fix-33: usePdfExport finally 清理
- src/composables/usePdfExport.ts - 使用 finally 块
- 影响：前端 L25

## 第六批：i18n 硬编码修复（16 个文件）

### Fix-34: 采购单组件 i18n（10 个文件）
- PurchaseOrderCreateDrawer.vue
- PurchaseOrderSuggestionsDrawer.vue
- PurchaseOrderCostModal.vue
- PurchaseOrderReceiptReversalModal.vue
- PurchaseOrderDetailDrawer.vue
- PurchaseOrderListTable.vue
- PurchaseOrderDetailCost.vue
- PurchaseOrderShortageModal.vue
- PurchaseOrderReceiptsPanel.vue
- PurchaseOrderDetail.vue（如适用）

### Fix-35: AI 组件 i18n
- ActionResultCard.vue - 11 个字符串
- SlotQuestionCard.vue - 1 个字符串

### Fix-36: 管理组件 i18n
- OrderManager.vue - 3 个字符串
- SalespersonManager.vue - 2 个字符串
- SalespersonPicker.vue - 1 个字符串

### Fix-37: 空间组件 i18n
- SpaceProductEditor.vue - 5 个字符串
- SpaceCreateModal.vue - 1 个字符串

### Fix-38: 其他组件 i18n
- AIChatWidget.vue - 1 个字符串
- VariantBatchBuilderModal.vue - 英文硬编码
- PwaInstallPrompt.vue - 中文硬编码
- useCommandPalette.ts - 中文 fallback
- useFormDraft.ts - 中文时间文本

## 第七批：设计系统一致性（3 个文件）

### Fix-39: SpaceProductEditor 设计 token
- 替换 5 个硬编码颜色为 token

### Fix-40: NotificationList 设计 token
- 替换 3 个硬编码颜色

### Fix-41: 其他文件设计 token
- SpaceMediaGrid、SpaceProductDetail、SpacePassword 等
