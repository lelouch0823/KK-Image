import { success } from '../utils/response.js';

export async function onRequest(context) {
  const { env } = context;

  // 检查是否配置了 Basic Auth
  const isAuthConfigured = env.BASIC_USER && env.BASIC_USER !== '';

  return success({
    authEnabled: isAuthConfigured
  }, isAuthConfigured ? 'Basic auth is enabled' : 'Basic auth is not configured');
}