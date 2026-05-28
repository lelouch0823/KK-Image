import { z } from 'zod';

/**
 * 变体图片 Schema（变体内嵌套）
 */
const VariantImageSchema = z.object({
    image_id: z.string().min(1),
    is_primary: z.union([z.number(), z.boolean()]).optional(),
}).strict();

/**
 * 商品变体 Schema（创建/更新共用）
 * 注: sku 和 stock_quantity 在 schema 层允许省略，
 * 由下游 validateProductPayload 按场景校验是否必填。
 */
const ProductVariantSchema = z.object({
    id: z.string().optional(),
    sku: z.string().optional(),
    price: z.number().nonnegative(),
    cost_price: z.number().nonnegative(),
    stock_quantity: z.number().int().nonnegative().optional(),
    alert_threshold: z.number().int().nonnegative().optional(),
    status: z.enum(['active', 'archived']).optional(),
    options_values: z.record(z.string()).optional(),
    image_id: z.string().nullable().optional(),
    images: z.array(VariantImageSchema).optional(),
    barcode: z.string().nullable().optional(),
    supplier_sku: z.string().nullable().optional(),
}).strict();

/**
 * 规格维度值 Schema（嵌套在维度内）
 * 支持字符串简写和完整对象形式
 */
const DimensionValueSchema = z.union([
    z.string(),
    z.object({
        id: z.string().optional(),
        value: z.string().min(1),
        status: z.enum(['active', 'archived']).optional(),
        meta: z.unknown().optional(),
    }).strict(),
]);

/**
 * 规格维度 Schema（创建/更新商品时嵌套）
 * 支持通过 id 匹配已有维度进行更新
 */
const DimensionSchema = z.object({
    id: z.string().optional(),
    name: z.string().min(1),
    status: z.enum(['active', 'archived']).optional(),
    sort_order: z.number().int().optional(),
    values: z.array(DimensionValueSchema).optional(),
}).strict();

/**
 * 创建商品 Schema (POST /)
 */
export const CreateProductSchema = z.object({
    name: z.string().min(1, '商品名称必填'),
    spu: z.union([z.string(), z.number()]).optional(),
    slug: z.string().optional(),
    category: z.string().optional(),
    brand: z.string().optional(),
    series: z.string().optional(),
    currency: z.string().optional(),
    description: z.string().optional(),
    images: z.array(z.string()).optional(),
    specifications: z.record(z.unknown()).optional(),
    options: z.array(z.unknown()).optional(),
    variants: z.array(ProductVariantSchema).min(1, '至少需要一个变体'),
    dimensions: z.array(DimensionSchema).optional(),
}).strict();

/**
 * 更新商品 Schema (PATCH /:id, PUT /:id)
 * 所有字段可选，由下游 fullReplace 参数控制全量/增量语义
 */
export const UpdateProductSchema = z.object({
    name: z.string().min(1).optional(),
    spu: z.union([z.string(), z.number()]).optional(),
    slug: z.string().optional(),
    category: z.string().optional(),
    brand: z.string().optional(),
    series: z.string().optional(),
    currency: z.string().optional(),
    description: z.string().optional(),
    images: z.array(z.string()).optional(),
    specifications: z.record(z.unknown()).optional(),
    options: z.array(z.unknown()).optional(),
    variants: z.array(ProductVariantSchema).optional(),
    dimensions: z.array(DimensionSchema).optional(),
}).strict();

/**
 * 创建规格维度 Schema (POST /:id/dimensions)
 */
export const CreateDimensionSchema = z.object({
    name: z.string().min(1, '维度名称必填'),
    sort_order: z.number().int().optional(),
}).strict();

/**
 * 更新规格维度 Schema (PATCH /:id/dimensions/:dimensionId)
 */
export const UpdateDimensionSchema = z.object({
    name: z.string().min(1).optional(),
    sort_order: z.number().int().optional(),
}).strict();

/**
 * 归档规格维度 Schema (PATCH /:id/dimensions/:dimensionId/archive)
 */
export const ArchiveDimensionSchema = z.object({
    mode: z.enum(['archive_variants', 'merge_keep']).optional(),
}).strict();

/**
 * 创建规格值 Schema (POST /:id/dimensions/:dimensionId/values)
 */
export const CreateDimensionValueSchema = z.object({
    value: z.string().min(1, '规格值必填'),
    sort_order: z.number().int().optional(),
    meta: z.unknown().optional(),
}).strict();

/**
 * 影响预览 Schema (POST /:id/dimensions/impact)
 */
export const DimensionImpactPreviewSchema = z.object({
    action: z.enum(['archive_dimension', 'archive_value']),
    dimensionId: z.string().optional(),
    valueId: z.string().optional(),
}).strict();

/**
 * 添加变体图片 Schema (POST /:id/variants/:variantId/images)
 */
export const AddVariantImageSchema = z.object({
    imageId: z.string().min(1, 'imageId 必填'),
    isPrimary: z.union([z.boolean(), z.string()]).optional(),
}).strict();

/**
 * 变体图片排序 Schema (PATCH /:id/variants/:variantId/images/sort)
 */
export const SortVariantImagesSchema = z.object({
    imageIds: z.array(z.string().min(1)).min(1, 'imageIds 不能为空'),
}).strict();
