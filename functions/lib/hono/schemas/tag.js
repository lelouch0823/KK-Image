import { z } from 'zod';

/** 创建标签 */
export const CreateTagSchema = z
  .object({
    name: z.string().min(1, '标签名不能为空').max(100),
    color: z.string().max(20).optional(),
  })
  .strict();

/** 分配/移除标签（文件级） */
export const AssignTagSchema = z
  .object({
    file_id: z.string().min(1),
    tag_id: z.string().min(1),
  })
  .strict();
