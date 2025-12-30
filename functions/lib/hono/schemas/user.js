import { z } from 'zod';
import { MSG } from '../_shared/utils.js';

/**
 * 用户登录 Schema
 */
export const LoginSchema = z.object({
    username: z.string().min(1, MSG.USER.NAME_REQUIRED).max(50),
    password: z.string().min(1, MSG.USER.PASSWORD_REQUIRED).max(100),
    turnstileToken: z.string().optional()
});

/**
 * 用户创建 Schema
 */
export const CreateUserSchema = z.object({
    username: z.string().min(3).max(50).regex(/^[a-zA-Z0-9_]+$/, MSG.USER.INVALID_CHARS),
    password: z.string().min(6).max(100),
    name: z.string().min(1).max(100),
    email: z.string().email().optional(),
    role: z.enum(['admin', 'user', 'viewer']).default('user'),
    permissions: z.array(z.string()).optional()
});

/**
 * 用户更新 Schema
 */
export const UpdateUserSchema = z.object({
    name: z.string().min(1).max(100).optional(),
    email: z.string().email().optional(),
    password: z.string().min(6).max(100).optional(),
    role: z.enum(['admin', 'user', 'viewer']).optional(),
    permissions: z.array(z.string()).optional()
});

/**
 * Token 生成 Schema
 */
export const TokenSchema = z.object({
    username: z.string().min(1),
    password: z.string().min(1),
    expiresIn: z.number().int().min(60).max(604800).default(3600) // 1分钟到7天
});

/**
 * API Key 创建 Schema
 */
export const CreateApiKeySchema = z.object({
    name: z.string().min(1).max(100),
    permissions: z.array(z.string()).default(['read']),
    expiresAt: z.string().datetime().optional().nullable()
});
