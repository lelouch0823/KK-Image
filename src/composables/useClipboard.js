import { useToast } from './useToast';
import { useI18n } from './useI18n';

/**
 * 剪贴板操作 Composable
 */
export function useClipboard() {
    const { addToast } = useToast();
    const { t } = useI18n();

    /**
     * 复制文本到剪贴板
     * @param {string} text 要复制的文本
     * @param {object} options 配置选项
     * @param {string} options.successMessage 成功消息
     * @param {string} options.errorMessage 失败消息
     * @param {boolean} options.showToast 是否显示 Toast
     * @returns {Promise<boolean>} 是否成功
     */
    const copy = async (text, options = {}) => {
        const {
            successMessage = t('common.copied'),
            errorMessage = t('common.copyFailed'),
            showToast = true
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
        } catch (err) {
            console.error('Copy to clipboard failed:', err);
            if (showToast) {
                addToast({ message: errorMessage, type: 'error' });
            }
            return false;
        }
    };

    /**
     * 从剪贴板读取文本
     * @returns {Promise<string|null>} 剪贴板内容
     */
    const paste = async () => {
        try {
            if (navigator.clipboard && window.isSecureContext) {
                return await navigator.clipboard.readText();
            }
            return null;
        } catch (err) {
            console.error('Paste from clipboard failed:', err);
            return null;
        }
    };

    return {
        copy,
        paste
    };
}
