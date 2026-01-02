/**
 * 共享工具模块 Barrel File
 * 集中导出所有后端共享工具，简化导入路径
 *
 * 用法：
 * import { success, error, MSG, generateId, getFileUrl } from '../../_shared/utils.js';
 *
 * @module _shared/utils
 */

// 响应工具
export { success, error } from '../api/utils/response.js';

// 消息常量
export { MSG } from '../api/utils/messages.js';

// ID 生成工具
export {
  generateId,
  generateShareToken,
  generatePrefixedId,
  hashPassword,
  generateHmacSignature,
  now,
  timestampToIso,
  sha256Hex,
  generateOrderNo,
} from '../api/utils/id.js';

// URL 生成工具
export { getShareUrl, getFileUrl } from '../api/utils/url.js';

// 认证工具
export { generateJWT, verifyJWT, ADMIN_AUTH_COOKIE, verifyTurnstile } from '../api/utils/auth.js';

// 后端常量
export { CORS_MAX_AGE, ORDER_STATUSES } from '../api/utils/constants.js';

// Webhook 工具
export { triggerWebhook } from '../api/utils/webhook.js';

// 文件夹工具
export { ensureFolder, moveFilesToFolder } from '../api/utils/folder-utils.js';

// 销售人员认证
export { authenticateSalesperson } from '../api/utils/salesperson-auth.js';

// ETag 工具
export { generateETag, matchesETag } from '../api/utils/etag.js';
