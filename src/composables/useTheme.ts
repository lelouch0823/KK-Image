import { ref, onMounted, onUnmounted, type Ref } from 'vue';

const isDark: Ref<boolean> = ref(false);

export function useTheme() {
  const toggleTheme = (): void => {
    isDark.value = !isDark.value;
    updateTheme();
  };

  const updateTheme = (): void => {
    const html = document.documentElement;
    if (isDark.value) {
      html.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      html.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  };

  const initTheme = (): void => {
    const savedTheme = localStorage.getItem('theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;

    if (savedTheme === 'dark' || (!savedTheme && prefersDark)) {
      isDark.value = true;
    } else {
      isDark.value = false;
    }
    updateTheme();
  };

  // 监听系统主题变化
  const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
  const handleSystemThemeChange = (e: MediaQueryListEvent): void => {
    // 仅在用户未手动设置主题时跟随系统
    const savedTheme = localStorage.getItem('theme');
    if (!savedTheme) {
      isDark.value = e.matches;
      updateTheme();
    }
  };

  onMounted(() => {
    initTheme();
    mediaQuery.addEventListener('change', handleSystemThemeChange);
  });

  onUnmounted(() => {
    mediaQuery.removeEventListener('change', handleSystemThemeChange);
  });

  return {
    isDark,
    toggleTheme,
    initTheme,
    updateTheme
  };
}
