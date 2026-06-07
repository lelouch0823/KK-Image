import { z } from 'zod';

/** 空间文件操作 Schema（添加/移除/排序文件） */
export const SpaceFileIdsSchema = z
  .object({
    fileIds: z.array(z.string().min(1)).min(1, '请提供至少一个文件 ID').max(100),
  })
  .strict();
