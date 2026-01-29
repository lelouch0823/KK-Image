import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useTheme } from '../useTheme';

describe('useTheme Composable', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
    document.documentElement.className = '';
    
    // Mock window.matchMedia
    vi.stubGlobal('window', {
      matchMedia: vi.fn().mockReturnValue({
        matches: false,
      }),
    });
  });

  it('toggleTheme should switch theme', () => {
    const { isDark, toggleTheme } = useTheme();
    isDark.value = false;
    
    toggleTheme();
    expect(isDark.value).toBe(true);
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    
    toggleTheme();
    expect(isDark.value).toBe(false);
    expect(document.documentElement.classList.contains('dark')).toBe(false);
  });

  it('initTheme should load from localStorage', () => {
    localStorage.setItem('theme', 'dark');
    const { isDark, initTheme } = useTheme();
    
    initTheme();
    expect(isDark.value).toBe(true);
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    
    localStorage.setItem('theme', 'light');
    initTheme();
    expect(isDark.value).toBe(false);
  });

  it('initTheme should fallback to system preference', () => {
    vi.stubGlobal('window', {
      matchMedia: vi.fn().mockReturnValue({ matches: true }),
    });
    const { isDark, initTheme } = useTheme();
    
    initTheme();
    expect(isDark.value).toBe(true);
  });

  it('initTheme should default to light if no storage and no system preference', () => {
    vi.stubGlobal('window', {
      matchMedia: vi.fn().mockReturnValue({ matches: false }),
    });
    const { isDark, initTheme } = useTheme();
    
    initTheme();
    expect(isDark.value).toBe(false);
  });
});
