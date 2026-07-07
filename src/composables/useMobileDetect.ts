import { ref, onMounted, onUnmounted } from 'vue';

/**
 * 移动端检测 composable
 * @param breakpoint - 桌面端最小宽度（px），默认 640
 */
export function useMobileDetect(breakpoint = 640) {
  const isMobile = ref(false);
  let mql: MediaQueryList | null = null;

  const handler = (e: MediaQueryListEvent) => {
    isMobile.value = !e.matches;
  };

  onMounted(() => {
    mql = window.matchMedia(`(min-width: ${breakpoint}px)`);
    isMobile.value = !mql.matches;
    mql.addEventListener('change', handler);
  });

  onUnmounted(() => {
    mql?.removeEventListener('change', handler);
  });

  return { isMobile };
}
