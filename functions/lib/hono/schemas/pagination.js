import { z } from 'zod';

/**
 * 通用分页查询参数 Schema
 * 用于所有列表端点的 zValidator('query', PaginationQuerySchema)
 */
export const PaginationQuerySchema = z
  .object({
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(20),
  })
  .strict();

/**
 * 带搜索的分页查询参数 Schema
 */
export const SearchPaginationQuerySchema = PaginationQuerySchema.extend({
  q: z.string().max(200).optional(),
}).strict();
