import { z } from 'zod';

/**
 * 文件创建 Schema
 */
export const CreateFileSchema = z.object({
    name: z.string().min(1, '文件名不能为空').max(255, '文件名过长'),
    folderId: z.string().uuid('无效的文件夹 ID').optional().nullable(),
    isPublic: z.boolean().default(false),
    tags: z.array(z.string().max(50)).max(10).optional(),
    description: z.string().max(500).optional()
});

/**
 * 文件更新 Schema
 */
export const UpdateFileSchema = CreateFileSchema.partial();

/**
 * 文件查询参数 Schema
 */
export const FileQuerySchema = z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    sort: z.enum(['created_at', 'name', 'size', 'updated_at']).default('created_at'),
    order: z.enum(['asc', 'desc']).default('desc'),
    folderId: z.string().uuid().optional(),
    search: z.string().max(100).optional(),
    type: z.enum(['image', 'video', 'document', 'other', 'all']).default('all'),
    isPublic: z.coerce.boolean().optional()
});

/**
 * 批量操作 Schema
 */
export const BatchFileSchema = z.object({
    ids: z.array(z.string().uuid()).min(1).max(100),
    action: z.enum(['delete', 'move', 'copy', 'updateVisibility']).optional()
});

/**
 * 文件移动 Schema
 */
export const MoveFileSchema = z.object({
    ids: z.array(z.string().uuid()).min(1).max(100),
    targetFolderId: z.string().uuid().nullable()
});
