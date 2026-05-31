import { ref, onMounted, type Ref } from 'vue';

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

  onMounted(() => {
    initTheme();
  });

  return {
    isDark,
    toggleTheme,
    initTheme,
    updateTheme
  };
}
