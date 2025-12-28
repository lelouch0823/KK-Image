// 简化的认证端点用于测试
import { success, error } from '../utils/response.js';

export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    const credentials = await request.json();

    if (!credentials.username || !credentials.password) {
      return error('Username and password are required', 400);
    }

    // 简单的硬编码验证用于测试
    if (credentials.username === 'admin' && credentials.password === '123') {
      return success({
        token: 'test-token-123',
        tokenType: 'Bearer',
        expiresIn: 3600,
        user: {
          id: 'admin',
          name: 'Administrator',
          permissions: ['admin:full']
        }
      });
    } else {
      return error('Invalid credentials', 401);
    }

  } catch (error) {
    return error(error.message, 500);
  }
}
