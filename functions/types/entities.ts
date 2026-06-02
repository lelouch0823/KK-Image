/**
 * 实体类型定义
 * 用于 Repository 层的数据模型
 */

// ==================== 标签 (Tag) ====================

/** 标签实体 */
export interface Tag {
  id: string;
  name: string;
  color: string | null;
  created_at: number;
}

/** 创建标签参数 */
export interface CreateTagData {
  id: string;
  name: string;
  color?: string;
  createdAt: number;
}

/** 标签分配参数 */
export interface AssignTagData {
  fileId: string;
  tagId: string;
  createdAt: number;
}

/** 标签搜索建议 */
export interface TagSuggestion {
  id: string;
  name: string;
  color: string | null;
}

// ==================== 客户 (Customer) ====================

/** 客户实体 */
export interface Customer {
  id: string;
  name: string;
  phone: string;
  company: string;
  email: string;
  address: string;
  tags: string[];
  remark: string;
  created_by: string;
  created_at: number;
  updated_at: number;
}

/** 创建客户参数 */
export interface CreateCustomerData {
  name: string;
  phone?: string;
  company?: string;
  email?: string;
  address?: string;
  tags?: string[];
  remark?: string;
  createdBy?: string;
}

/** 更新客户参数 */
export interface UpdateCustomerData {
  name?: string;
  phone?: string;
  company?: string;
  email?: string;
  address?: string;
  tags?: string[];
  remark?: string;
}

/** 客户搜索建议 */
export interface CustomerSuggestion {
  id: string;
  name: string;
  phone: string;
  company: string;
}

/** 客户订单统计 */
export interface CustomerOrderStats {
  orderCount: number;
  firstOrderAt: number | null;
  lastOrderAt: number | null;
  recencyDays: number | null;
}

/** RFM 分段类型 */
export type RfmSegment = 'new' | 'vip' | 'active' | 'at-risk' | 'lost';

/** RFM 分段结果 */
export interface RfmSegmentData {
  orderCount: number;
  firstOrderAt: number | null;
  lastOrderAt: number | null;
  recencyDays: number | null;
  segment: RfmSegment;
}

/** 客户标签 */
export interface CustomerTag {
  id: number;
  name: string;
  createdAt: number;
}

/** 沟通记录类型 */
export type CommunicationType = 'note' | 'call' | 'email' | 'meeting' | 'wechat';

/** 沟通记录 */
export interface Communication {
  id: string;
  customer_id: string;
  type: CommunicationType;
  content: string;
  created_at: number;
  created_by: string | null;
}

/** 常用商品 */
export interface FavoriteProduct {
  productId: string;
  productName: string;
  orderCount: number;
}

// ==================== 系统设置 (Settings) ====================

/** 系统设置行 */
export interface SettingRow {
  key: string;
  value: string;
  category: string;
  description: string | null;
  updatedAt: number;
}

/** 创建/更新设置参数 */
export interface UpsertSettingData {
  value: string;
  category?: string;
  description?: string;
}

/** 批量设置参数 */
export interface BatchSettingData {
  key: string;
  value: string;
  category?: string;
  description?: string;
}

/** 分组设置结果 */
export type GroupedSettings = Record<string, Record<string, string>>;

// ==================== 商品 (Product) ====================

/** 商品状态 */
export type ProductStatus = 'draft' | 'active' | 'archived';

/** 商品货币 */
export type ProductCurrency = 'CNY' | 'USD' | 'EUR' | 'GBP' | 'JPY';

/** 商品实体（数据库行） */
export interface ProductRow {
  id: string;
  name: string;
  spu: string | null;
  slug: string | null;
  category: string | null;
  brand: string | null;
  series: string | null;
  currency: string;
  description: string;
  images: string;
  specifications: string;
  options: string;
  status: ProductStatus;
  product_code?: string;
  created_at: number;
  updated_at: number;
}

/** 商品实体（解析后） */
export interface Product extends Omit<ProductRow, 'images' | 'specifications' | 'options'> {
  images: string[];
  specifications: Record<string, unknown>;
  options: unknown[];
  price?: number;
  cost_price?: number;
  stock_quantity?: number;
  available_quantity?: number;
  alert_threshold?: number;
}

/** 创建商品参数 */
export interface CreateProductData {
  name: string;
  spu?: string;
  slug?: string;
  category?: string;
  brand?: string;
  series?: string;
  currency?: string;
  description?: string;
  images?: string[];
  specifications?: Record<string, unknown>;
  options?: unknown[];
  status?: ProductStatus;
}

/** 更新商品参数 */
export interface UpdateProductData {
  name?: string;
  spu?: string;
  slug?: string;
  category?: string;
  brand?: string;
  series?: string;
  currency?: string;
  description?: string;
  images?: string[];
  specifications?: Record<string, unknown>;
  options?: unknown[];
  status?: ProductStatus;
}

/** 商品搜索过滤器 */
export interface ProductFilters {
  status?: ProductStatus;
  category?: string;
  brand?: string;
  search?: string;
  hasStock?: 'in_stock' | 'out_of_stock';
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

/** 商品搜索结果 */
export interface ProductSearchResult {
  items: Product[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  filters: {
    brands: string[];
    categories: string[];
  };
}

/** 商品搜索建议 */
export interface ProductSuggestion {
  id: string;
  name: string;
  brand: string;
  spu: string;
}

/** 批量创建结果 */
export interface BatchCreateResult {
  success: boolean;
  count: number;
  errors: Array<{ spu?: string; error: string }>;
}

/** 更新结果元数据 */
export interface UpdateResultMeta {
  success: boolean;
  changes: number;
  error?: string;
}

// ==================== 商品规格 (ProductVariant) ====================

/** 商品规格状态 */
export type VariantStatus = 'active' | 'archived';

/** 商品规格行（数据库原始行） */
export interface ProductVariantRow {
  id: string;
  product_id: string;
  sku: string;
  variant_code?: string;
  price: number;
  cost_price: number | null;
  stock_quantity: number;
  alert_threshold: number;
  options_values: string;
  variant_signature: string;
  image_id: string | null;
  status: VariantStatus;
  barcode: string | null;
  supplier_sku: string | null;
  created_at: number;
  updated_at: number;
}

/** 商品规格（含库存信息） */
export interface ProductVariant extends Omit<ProductVariantRow, 'options_values'> {
  options_values: Record<string, unknown>;
  on_hand?: number;
  reserved?: number;
  available_quantity?: number;
}

/** 创建商品规格参数 */
export interface CreateVariantData {
  id?: string;
  sku?: string;
  price?: number;
  cost_price?: number | null;
  stock_quantity?: number;
  alert_threshold?: number;
  options_values?: Record<string, unknown>;
  image_id?: string | null;
  status?: VariantStatus;
  barcode?: string | null;
  supplier_sku?: string | null;
}

/** 商品规格搜索过滤器 (AI) */
export interface VariantAISearchFilters {
  status?: VariantStatus;
  productId?: string;
  brand?: string;
  category?: string;
  search?: string;
  limit?: number;
}

/** 商品规格审计事件 */
export interface VariantAuditEvent {
  variant_id: string;
  product_id: string;
  action: 'variant_created' | 'variant_updated' | 'variant_archived';
  changes: {
    before?: Record<string, unknown>;
    after?: Record<string, unknown>;
  };
}

/** 同步规格计划 */
export interface SyncVariantPlan {
  id?: string;
  sku?: string;
  price?: number;
  cost_price?: number | null;
  stock_quantity?: number;
  alert_threshold?: number;
  options_values?: Record<string, unknown>;
  image_id?: string | null;
  status?: VariantStatus;
  barcode?: string | null;
  supplier_sku?: string | null;
}

/** 同步规格结果（带统计扩展） */
export interface SyncVariantResult extends Array<Record<string, unknown>> {
  createdCount?: number;
  updatedCount?: number;
  archivedCount?: number;
  reactivatedCount?: number;
  deletedCount?: number;
}

/** 批量同步导入计划 */
export interface BulkSyncImportPlan {
  itemKey?: string;
  productId: string;
  variantsToSync: SyncVariantPlan[];
  existingVariants?: Record<string, unknown>[];
  fallbackStats?: {
    createdCount?: number;
    updatedCount?: number;
    archivedCount?: number;
    reactivatedCount?: number;
  };
}

/** 批量同步导入结果 */
export interface BulkSyncResult {
  successes: Array<{
    itemKey?: string;
    productId: string;
    stats: {
      createdCount: number;
      updatedCount: number;
      archivedCount: number;
      reactivatedCount: number;
    };
    variants: SyncVariantResult;
  }>;
  failures: Array<{
    itemKey?: string;
    productId: string | null;
    error: unknown;
  }>;
}

/** 批量创建商品规格结果 */
export interface VariantCreateBatchResult {
  id: string;
  sku: string;
  variant_code: string;
  product_id: string;
  stock_quantity: number;
  on_hand: number;
  reserved: number;
  available_quantity: number;
  options_values: Record<string, unknown>;
  created_at: number;
  updated_at: number;
  [key: string]: unknown;
}

// ==================== 销售人员 (Salesperson) ====================

/** 销售人员实体 */
export interface SalespersonRow {
  id: string;
  name: string;
  store: string | null;
  phone: string | null;
  access_token: string;
  password_hash: string;
  is_active: number;
  wechat_openid: string | null;
  last_login_at: number | null;
  last_login_ip: string | null;
  last_login_device: string | null;
  created_at: number;
  updated_at: number;
}

/** 创建销售人员参数 */
export interface CreateSalespersonData {
  name: string;
  store?: string;
  phone?: string;
  password: string;
}

/** 更新销售人员参数 */
export interface UpdateSalespersonData {
  name?: string;
  store?: string;
  phone?: string;
  password?: string;
  isActive?: boolean;
}

/** 销售人员排行榜项 */
export interface SalespersonRankingItem {
  id: string;
  name: string;
  store: string | null;
  order_count: number;
  avg_monthly: number;
}

/** 销售人员列表分页参数 */
export interface SalespersonListParams {
  page?: number;
  limit?: number;
  search?: string;
}

// ==================== 通知 (Notification) ====================

/** 通知类型 */
export type NotificationType = 'system' | 'order' | 'deadline' | string;

/** 通知接收方 */
export type NotificationReceiver = 'admin' | 'sales';

/** 通知实体（数据库行） */
export interface NotificationRow {
  id: string;
  type: NotificationType;
  title: string;
  content: string;
  link: string;
  is_read: number;
  receiver: NotificationReceiver;
  salesperson_id: string | null;
  order_id: string | null;
  metadata: string | null;
  source_consumer: string | null;
  source_event_id: string | null;
  dedupe_key: string | null;
  created_at: number;
}

/** 创建通知参数 */
export interface CreateNotificationData {
  type: NotificationType;
  title: string;
  content?: string;
  link?: string;
  receiver: NotificationReceiver;
  salespersonId?: string | null;
  orderId?: string | null;
  metadata?: Record<string, unknown> | null;
}

/** 领域事件通知参数 */
export interface DomainEventNotificationData extends CreateNotificationData {
  sourceConsumer: string;
  sourceEventId?: string;
  dedupeKey: string;
}

/** 通知映射后结果 */
export interface NotificationItem {
  id: string;
  type: NotificationType;
  title: string;
  content: string;
  link: string;
  is_read: number;
  receiver: NotificationReceiver;
  orderId: string | null;
  metadata: Record<string, unknown> | null;
  created_at: number;
}

/** 通知列表结果 */
export interface NotificationListResult {
  list: NotificationItem[];
  unreadCount: number;
}

/** 通知轮询结果 */
export interface NotificationPollResult {
  unreadCount: number;
  latestId: string | null;
  newNotifications: NotificationItem[];
}

/** 创建通知结果 */
export interface CreateNotificationResult {
  id: string;
}

/** 领域事件通知结果 */
export interface DomainEventResult {
  id: string;
  created: boolean;
}

// ==================== 共享空间 (Space) ====================

/** 共享空间分享模式 */
export type SpaceShareMode = 'none' | 'all' | 'selected';

/** 共享空间实体 */
export interface SpaceRow {
  id: string;
  parent_id: string | null;
  name: string;
  description: string | null;
  is_public: number;
  password: string | null;
  share_token: string | null;
  expires_at: number | null;
  template: string | null;
  template_data: string | null;
  share_mode: SpaceShareMode;
  product_id: string | null;
  variant_id: string | null;
  cover_file_id: string | null;
  view_count: number;
  download_count: number;
  sort_order: number;
  created_at: number;
  updated_at: number;
}

/** 创建空间参数 */
export interface CreateSpaceData {
  id: string;
  name: string;
  description?: string | null;
  isPublic: boolean;
  password?: string | null;
  shareToken?: string | null;
  expiresAt?: number | null;
  template?: string | null;
  templateData?: string | null;
  shareMode?: SpaceShareMode;
  productId?: string | null;
  variantId?: string | null;
  createdAt: number;
  updatedAt: number;
}

/** 创建子空间参数 */
export interface CreateSubspaceData extends CreateSpaceData {
  parentId: string;
}

/** 空间统计信息 */
export interface SpaceStats {
  viewCount: number;
  downloadCount: number;
  fileCount: number;
  totalSize: number;
  trendData: Array<{ date: string; count: number }>;
}

/** 空间及其文件 */
export interface SpaceWithFiles {
  space: Record<string, unknown>;
  files: Record<string, unknown>[];
}

// ==================== 通用工具类型 ====================

/** Set 子句构建结果 */
export interface SetClauseResult {
  clause: string;
  values: unknown[];
}

/** 更新参数构建结果 */
export interface UpdateParamsResult {
  clause: string | null;
  values: unknown[] | null;
  error: string | null;
}

/** 批量执行结果项 */
export interface BatchResultItem {
  success: boolean;
  meta?: D1Meta;
}

/** D1Meta 重新导出（兼容性） */
import type { D1Meta } from './database.js';
