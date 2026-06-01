import { z } from 'zod';

/** 创建分类 */
export const CreateCategorySchema = z.object({
    name: z.string().min(1, '分类名不能为空').max(100),
    parent_id: z.string().optional().nullable(),
    sort_order: z.number().int().min(0).optional(),
}).strict();

/** 更新分类 */
export const UpdateCategorySchema = z.object({
    name: z.string().min(1, '分类名不能为空').max(100).optional(),
    parent_id: z.string().optional().nullable(),
    sort_order: z.number().int().min(0).optional(),
}).strict();

/** 设置分类下的商品 */
export const SetCategoryProductsSchema = z.object({
    product_ids: z.array(z.string().min(1)),
}).strict();

/** 设置商品的分类 */
export const SetProductCategoriesSchema = z.object({
    category_ids: z.array(z.string().min(1)),
}).strict();
