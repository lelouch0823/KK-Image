import { z } from 'zod';

/** 空间文件操作 Schema（移除/排序文件） */
export const SpaceFileIdsSchema = z
  .object({
    fileIds: z.array(z.string().min(1)).min(1, '请提供至少一个文件 ID').max(100),
  })
  .strict();

/**
 * 添加文件到空间 Schema（F1）。
 *
 * 支持两种载荷：直接给 fileIds，或给 folderIds（服务端递归展开文件夹
 * 及其子文件夹内的全部文件）。前端不再发送多余的 section 字段——
 * 旧 schema 是 .strict() 且只认 fileIds，无条件附带 section/folderIds
 * 的请求会一律 400（空间"添加文件"功能整体不可用）。
 */
export const SpaceAddFilesSchema = z
  .object({
    fileIds: z.array(z.string().min(1)).max(100).optional(),
    folderIds: z.array(z.string().min(1)).max(20).optional(),
  })
  .strict()
  .refine(
    (data) => (data.fileIds?.length || 0) + (data.folderIds?.length || 0) > 0,
    { message: '请提供至少一个文件或文件夹 ID' }
  );
