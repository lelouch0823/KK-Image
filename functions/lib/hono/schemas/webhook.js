import { z } from 'zod';

/** 创建 Webhook */
export const CreateWebhookSchema = z.object({
    url: z.string().url().max(500),
    events: z.array(z.string()).min(1),
    secret: z.string().max(200).optional(),
    headers: z.record(z.string()).optional(),
    enabled: z.boolean().optional(),
});

/** 更新 Webhook */
export const UpdateWebhookSchema = CreateWebhookSchema.partial();
