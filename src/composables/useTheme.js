import { ref, onMounted } from 'vue';

const isDark = ref(false);

export function useTheme() {
  const toggleTheme = () => {
    isDark.value = !isDark.value;
    updateTheme();
  };

  const updateTheme = () => {
    const html = document.documentElement;
    if (isDark.value) {
      html.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      html.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  };

  const initTheme = () => {
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
  };
}
