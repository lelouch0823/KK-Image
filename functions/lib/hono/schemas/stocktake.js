import { z } from 'zod';

/** 创建盘点单 */
export const CreateStocktakeSchema = z.object({
    notes: z.string().max(500).optional().nullable(),
}).strict();

/** 更新盘点单（备注） */
export const UpdateStocktakeSchema = z.object({
    notes: z.string().max(500).optional().nullable(),
}).strict();

/** 更新盘点明细 */
export const UpdateItemsSchema = z.object({
    items: z.array(z.object({
        itemId: z.string().min(1),
        actualQty: z.number().int(),
        notes: z.string().max(200).optional(),
    })).min(1).max(500),
});
