import { z } from 'zod';

/** 批量更新设置 */
export const BatchSettingsSchema = z
  .object({
    settings: z
      .array(
        z.object({
          key: z.string().min(1).max(200),
          value: z.string().max(10000),
          category: z.string().max(100).optional(),
          description: z.string().max(500).optional(),
        })
      )
      .min(1)
      .max(100),
  })
  .strict();

/** 单个更新设置 */
export const UpdateSettingSchema = z
  .object({
    value: z.string().max(10000).optional(),
    category: z.string().max(100).optional(),
    description: z.string().max(500).optional(),
  })
  .strict();

/** AI 模型配置 */
export const AiModelSchema = z
  .object({
    apiUrl: z.string().url().max(500),
    apiKey: z.string().min(1).max(500),
  })
  .strict();

/** AI 连通性测试 */
export const AiTestSchema = z
  .object({
    apiUrl: z.string().url().max(500),
    apiKey: z.string().min(1).max(500),
    model: z.string().max(200).optional().default(''),
  })
  .strict();
