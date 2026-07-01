import {
  getStepIconClasses,
  getStepperProgress,
  isStepCompleted,
} from '@/views/purchase-orders/stepper';
import { hasReceiptMeta } from '@/views/purchase-orders/progress';

/**
 * 详情抽屉需要的一组展示 helper 集中打包传入，避免子组件直接依赖页面外部实现。
 * 静态导入的 stepper/progress 函数直接内置，动态展示函数由调用方注入。
 */
export function createDetailHelpers({
  formatInteger,
  formatPurchaseCurrency,
  formatDate,
  getProgressStatusLabel,
  getProgressStatusVariant,
  buildReceiptProgressSummary,
  buildReceiptMeta,
  canReverseReceipt,
}) {
  return {
    formatInteger,
    formatPurchaseCurrency,
    formatDate,
    formatDateTime: formatDate,
    getProgressStatusLabel,
    getProgressStatusVariant,
    buildReceiptProgressSummary,
    buildReceiptMeta,
    getStepperProgress,
    getStepIconClasses,
    isStepCompleted,
    hasReceiptMeta,
    canReverseReceipt,
  };
}
