import { useToast } from './useToast';
import { useI18n } from './useI18n';

interface CopyOptions {
  successMessage?: string;
  errorMessage?: string;
  showToast?: boolean;
}

interface CopyShareLinkOptions {
  successMessage?: string;
}

/**
 * 剪贴板操作 Composable
 */
export function useClipboard() {
  const { addToast } = useToast();
  const { t } = useI18n();

  /**
   * 复制文本到剪贴板
   * @param text 要复制的文本
   * @param options 配置选项
   * @returns 是否成功
   */
  const copy = async (text: string, options: CopyOptions = {}): Promise<boolean> => {
    const {
      successMessage = t('common.copied'),
      errorMessage = t('common.copyFailed'),
      showToast = true,
    } = options;

    try {
      if (navigator.clipboard && window.isSecureContext) {
        // 优先使用现代 Clipboard API
        await navigator.clipboard.writeText(text);
      } else {
        // 降级方案：使用 execCommand
        const textArea = document.createElement('textarea');
        textArea.value = text;
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        textArea.style.top = '-999999px';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();

        const success = document.execCommand('copy');
        document.body.removeChild(textArea);

        if (!success) {
          throw new Error('execCommand failed');
        }
      }

      if (showToast) {
        addToast({ message: successMessage, type: 'success' });
      }
      return true;
    } catch (err: unknown) {
      console.error('Copy to clipboard failed:', err);
      if (showToast) {
        addToast({ message: errorMessage, type: 'error' });
      }
      return false;
    }
  };

  /**
   * 从剪贴板读取文本
   * @returns 剪贴板内容
   */
  const paste = async (): Promise<string | null> => {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        return await navigator.clipboard.readText();
      }
      return null;
    } catch (err: unknown) {
      console.error('Paste from clipboard failed:', err);
      return null;
    }
  };

  /**
   * 复制分享链接到剪贴板
   * 自动构建完整 URL 并显示成功提示
   * @param path 分享路径 (如 /space/xxx 或 /gallery/xxx)
   * @param options 配置选项
   * @returns 是否成功
   */
  const copyShareLink = async (path: string, options: CopyShareLinkOptions = {}): Promise<boolean> => {
    if (!path) {
      addToast({ message: t('common.copyFailed'), type: 'error' });
      return false;
    }
    // 构建完整 URL
    const url = path.startsWith('http') ? path : `${window.location.origin}${path}`;
    return copy(url, {
      successMessage: options.successMessage || t('share.linkCopied'),
      ...options,
    });
  };

  return {
    copy,
    paste,
    copyShareLink,
  };
}
