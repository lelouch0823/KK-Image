/**
 * 销售人员管理 API 封装
 * @module composables/useSalespersons
 */
import { useResource } from './useResource';
import { API } from '@/utils/constants';
import { useAuth } from './useAuth';
import { useToast } from './useToast';
import { useI18n } from './useI18n';

export function useSalespersons() {
  const { authFetch } = useAuth();
  const { addToast } = useToast();
  const { t } = useI18n();

  // 使用 useResource 管理基础 CRUD
  const resource = useResource(API.SALESPERSONS, {
    listPath: 'data.salespersons',
  });

  /**
   * 重置访问链接
   */
  const resetToken = async (id) => {
    try {
      const res = await authFetch(API.SALESPERSON_RESET_TOKEN(id), {
        method: 'POST',
      }).then(r => r.json());

      if (res.success) {
        addToast({ message: t('salesperson.linkReset'), type: 'success' });
        return res.data;
      } else {
        addToast({ message: res.message, type: 'error' });
        return null;
      }
    } catch (_e) {
      addToast({ message: t('common.networkError'), type: 'error' });
      return null;
    }
  };

  /**
   * 复制访问链接（兼容 HTTP 环境）
   */
  const copyAccessLink = async (accessToken) => {
    const url = `${window.location.origin}/sales/${accessToken}`;

    try {
      // 优先尝试现代 API (需要 HTTPS 或 localhost)
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(url);
        addToast({ message: t('salesperson.linkCopied'), type: 'success' });
        return true;
      }
    } catch (_e) {
      console.warn('Clipboard API failed, trying fallback...');
    }

    // Fallback: 使用 textarea 选中复制
    try {
      const textArea = document.createElement('textarea');
      textArea.value = url;

      // 避免滚动到底部
      textArea.style.top = '0';
      textArea.style.left = '0';
      textArea.style.position = 'fixed';
      textArea.style.opacity = '0';

      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();

      const successful = document.execCommand('copy');
      document.body.removeChild(textArea);

      if (successful) {
        addToast({ message: t('salesperson.linkCopied'), type: 'success' });
        return true;
      } else {
        throw new Error('execCommand returned false');
      }
    } catch (err) {
      console.error('Copy failed', err);
      addToast({ message: t('common.copyFailed'), type: 'error' });
      return false;
    }
  };

  return {
    salespersons: resource.items,
    loading: resource.loading,
    error: resource.error,
    errorCode: resource.errorCode,
    pagination: resource.pagination,
    loadSalespersons: resource.loadItems,
    createSalesperson: resource.createItem,
    updateSalesperson: resource.updateItem,
    deleteSalesperson: resource.deleteItem,
    resetToken,
    copyAccessLink,
  };
}
