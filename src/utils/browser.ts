export const NEW_TAB_FEATURES = 'noopener,noreferrer';

// 白名单协议：http(s) 与 blob:（AI 报告通过 blob URL 打开）
const SAFE_URL_SCHEME = /^(?:https?:|blob:)/i;
// 带任意其他 scheme（javascript:/data:/vbscript: 等）的 URL 一律拦截
const ANY_URL_SCHEME = /^[a-z][a-z0-9+.-]*:/i;

const isSafeNewTabUrl = (url: string): boolean => {
  if (!url) return false;
  const trimmed = url.trim();
  if (SAFE_URL_SCHEME.test(trimmed)) return true;
  // 协议相对 URL（//host）来源不明确，同样拦截
  if (trimmed.startsWith('//')) return false;
  // 其余含 scheme 的形式均已排除白名单，视为危险协议
  if (ANY_URL_SCHEME.test(trimmed)) return false;
  // 无 scheme 视为站内相对路径
  return true;
};

const detachOpener = (openedWindow: Window | null): Window | null => {
  if (openedWindow) {
    openedWindow.opener = null;
  }
  return openedWindow;
};

export const openInNewTab = (url: string): Window | null => {
  if (!isSafeNewTabUrl(url)) {
    console.warn(`[browser] Blocked opening untrusted URL in new tab: ${url}`);
    return null;
  }
  return detachOpener(window.open(url, '_blank', NEW_TAB_FEATURES));
};

export const openWritableNewTab = (): Window | null => {
  return detachOpener(window.open('', '_blank', 'popup'));
};
