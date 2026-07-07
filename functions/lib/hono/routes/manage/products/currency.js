/**
 * Re-export from services/_shared/ — canonical location.
 * 保留此文件以兼容路由层的相对导入。
 */
export {
  PRODUCT_CURRENCY_CODES,
  normalizeProductCurrency,
  assertAndNormalizeProductCurrency,
} from '../../../../../services/_shared/currency.js';
