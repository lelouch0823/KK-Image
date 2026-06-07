import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockAddToast = vi.fn();
const mockT = vi.fn((key) => key);

vi.mock('@/composables/useToast', () => ({
  useToast: () => ({ addToast: mockAddToast }),
}));

vi.mock('@/composables/useI18n', () => ({
  useI18n: () => ({ t: mockT }),
}));

describe('useClipboard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('copy', () => {
    it('应通过 navigator.clipboard.writeText 复制文本', async () => {
      const writeText = vi.fn().mockResolvedValue(undefined);
      Object.defineProperty(navigator, 'clipboard', {
        value: { writeText },
        writable: true,
        configurable: true,
      });
      Object.defineProperty(window, 'isSecureContext', {
        value: true,
        writable: true,
        configurable: true,
      });

      const { useClipboard } = await import('../useClipboard');
      const { copy } = useClipboard();
      const result = await copy('hello world');

      expect(result).toBe(true);
      expect(writeText).toHaveBeenCalledWith('hello world');
      expect(mockAddToast).toHaveBeenCalledWith(expect.objectContaining({ type: 'success' }));
    });

    it('当 navigator.clipboard 不可用时应降级到 execCommand', async () => {
      // 移除 clipboard API
      Object.defineProperty(navigator, 'clipboard', {
        value: undefined,
        writable: true,
        configurable: true,
      });

      const mockExecCommand = vi.fn().mockReturnValue(true);
      document.execCommand = mockExecCommand;

      const { useClipboard } = await import('../useClipboard');
      const { copy } = useClipboard();
      const result = await copy('fallback text');

      expect(result).toBe(true);
      expect(mockExecCommand).toHaveBeenCalledWith('copy');
      expect(mockAddToast).toHaveBeenCalledWith(expect.objectContaining({ type: 'success' }));
    });

    it('复制失败时应显示错误 toast 并返回 false', async () => {
      const writeText = vi.fn().mockRejectedValue(new Error('Permission denied'));
      Object.defineProperty(navigator, 'clipboard', {
        value: { writeText },
        writable: true,
        configurable: true,
      });
      Object.defineProperty(window, 'isSecureContext', {
        value: true,
        writable: true,
        configurable: true,
      });

      const { useClipboard } = await import('../useClipboard');
      const { copy } = useClipboard();
      const result = await copy('will fail');

      expect(result).toBe(false);
      expect(mockAddToast).toHaveBeenCalledWith(expect.objectContaining({ type: 'error' }));
    });

    it('showToast 为 false 时不显示 toast', async () => {
      const writeText = vi.fn().mockResolvedValue(undefined);
      Object.defineProperty(navigator, 'clipboard', {
        value: { writeText },
        writable: true,
        configurable: true,
      });
      Object.defineProperty(window, 'isSecureContext', {
        value: true,
        writable: true,
        configurable: true,
      });

      const { useClipboard } = await import('../useClipboard');
      const { copy } = useClipboard();
      await copy('silent copy', { showToast: false });

      expect(mockAddToast).not.toHaveBeenCalled();
    });
  });

  describe('paste', () => {
    it('应通过 navigator.clipboard.readText 读取剪贴板', async () => {
      const readText = vi.fn().mockResolvedValue('pasted text');
      Object.defineProperty(navigator, 'clipboard', {
        value: { readText },
        writable: true,
        configurable: true,
      });
      Object.defineProperty(window, 'isSecureContext', {
        value: true,
        writable: true,
        configurable: true,
      });

      const { useClipboard } = await import('../useClipboard');
      const { paste } = useClipboard();
      const result = await paste();

      expect(result).toBe('pasted text');
    });

    it('clipboard 不可用时应返回 null', async () => {
      Object.defineProperty(navigator, 'clipboard', {
        value: undefined,
        writable: true,
        configurable: true,
      });

      const { useClipboard } = await import('../useClipboard');
      const { paste } = useClipboard();
      const result = await paste();

      expect(result).toBeNull();
    });
  });

  describe('copyShareLink', () => {
    it('应构建完整 URL 并调用 copy', async () => {
      const writeText = vi.fn().mockResolvedValue(undefined);
      Object.defineProperty(navigator, 'clipboard', {
        value: { writeText },
        writable: true,
        configurable: true,
      });
      Object.defineProperty(window, 'isSecureContext', {
        value: true,
        writable: true,
        configurable: true,
      });
      Object.defineProperty(window, 'location', {
        value: { origin: 'https://example.com' },
        writable: true,
        configurable: true,
      });

      const { useClipboard } = await import('../useClipboard');
      const { copyShareLink } = useClipboard();
      const result = await copyShareLink('/space/abc');

      expect(result).toBe(true);
      expect(writeText).toHaveBeenCalledWith('https://example.com/space/abc');
    });

    it('路径为空时应显示错误 toast 并返回 false', async () => {
      const { useClipboard } = await import('../useClipboard');
      const { copyShareLink } = useClipboard();
      const result = await copyShareLink('');

      expect(result).toBe(false);
      expect(mockAddToast).toHaveBeenCalledWith(expect.objectContaining({ type: 'error' }));
    });

    it('已包含 http 的路径应直接使用', async () => {
      const writeText = vi.fn().mockResolvedValue(undefined);
      Object.defineProperty(navigator, 'clipboard', {
        value: { writeText },
        writable: true,
        configurable: true,
      });
      Object.defineProperty(window, 'isSecureContext', {
        value: true,
        writable: true,
        configurable: true,
      });

      const { useClipboard } = await import('../useClipboard');
      const { copyShareLink } = useClipboard();
      await copyShareLink('https://other.com/path');

      expect(writeText).toHaveBeenCalledWith('https://other.com/path');
    });
  });
});
