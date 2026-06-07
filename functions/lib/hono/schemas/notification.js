import { z } from 'zod';

/** 创建通知 */
export const CreateNotificationSchema = z
  .object({
    type: z.string().max(50).optional().default('system'),
    title: z.string().min(1).max(200),
    content: z.string().max(5000).optional().default(''),
    link: z.string().max(500).optional().default(''),
    metadata: z.record(z.unknown()).nullable().optional().default(null),
    orderId: z.string().nullable().optional().default(null),
  })
  .strict();
