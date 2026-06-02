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
