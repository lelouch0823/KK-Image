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

// 日期工具
export { DateUtils, getChinaDate, getChinaDayStart, getChinaDateStr } from '../api/utils/date.js';

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
export {
  generateJWT,
  verifyJWT,
  ADMIN_AUTH_COOKIE,
  extractAdminAuthToken,
  verifyTurnstile,
  timingSafeCompare,
  isAdminAuthenticated,
  verifyApiKey,
} from '../api/utils/auth.js';

// 后端常量
export { CORS_MAX_AGE, ORDER_STATUSES, ORDER_PROCUREMENT_STATUSES } from '../api/utils/constants.js';

// 文件夹工具
export { ensureFolder, moveFilesToFolder } from '../api/utils/folder-utils.js';

// 销售人员认证
export { authenticateSalesperson } from '../api/utils/salesperson-auth.js';

// ETag 工具
export { generateETag, matchesETag } from '../api/utils/etag.js';

// 文件工具
export { storeFile, getFileType } from '../api/utils/file-utils.js';

// SQL 占位符工具
export { placeholders, inClause, buildSetClause } from '../api/utils/sql.js';

// D1 结果工具
export { getChangesCount, hasChanges } from '../api/utils/result.js';

// JSON 解析工具
export { safeJsonParse, parseJsonArray, parseJsonObject } from '../api/utils/json.js';

// 分页工具
export { toPositiveInt, parseRepoPagination } from '../api/utils/pagination.js';
