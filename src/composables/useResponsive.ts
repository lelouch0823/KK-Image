import { ref, onMounted, onScopeDispose } from 'vue';

type BreakpointKey = 'sm' | 'md' | 'lg' | 'xl' | '2xl';

/**
 * 响应式断点检测 Composable
 */
export function useResponsive() {
  // 断点定义（与 Tailwind 保持一致）
  const breakpoints: Record<BreakpointKey, number> = {
    sm: 640,
    md: 768,
    lg: 1024,
    xl: 1280,
    '2xl': 1536,
  };

  const width = ref<number>(typeof window !== 'undefined' ? window.innerWidth : 0);
  const height = ref<number>(typeof window !== 'undefined' ? window.innerHeight : 0);

  // 响应式布尔值
  const isMobile = ref<boolean>(false);
  const isTablet = ref<boolean>(false);
  const isDesktop = ref<boolean>(false);
  const isLargeDesktop = ref<boolean>(false);

  // 更新状态
  const updateDimensions = (): void => {
    width.value = window.innerWidth;
    height.value = window.innerHeight;

    isMobile.value = width.value < breakpoints.md;
    isTablet.value = width.value >= breakpoints.md && width.value < breakpoints.lg;
    isDesktop.value = width.value >= breakpoints.lg;
    isLargeDesktop.value = width.value >= breakpoints.xl;
  };

  // 检查是否满足某个断点
  const isAbove = (breakpoint: BreakpointKey): boolean => {
    const bp = breakpoints[breakpoint];
    return bp ? width.value >= bp : false;
  };

  const isBelow = (breakpoint: BreakpointKey): boolean => {
    const bp = breakpoints[breakpoint];
    return bp ? width.value < bp : false;
  };

  const isBetween = (minBp: BreakpointKey, maxBp: BreakpointKey): boolean => {
    const min = breakpoints[minBp];
    const max = breakpoints[maxBp];
    if (!min || !max) return false;
    return width.value >= min && width.value < max;
  };

  // 防抖处理
  let resizeTimer: ReturnType<typeof setTimeout> | null = null;
  const handleResize = (): void => {
    clearTimeout(resizeTimer!);
    resizeTimer = setTimeout(updateDimensions, 100);
  };

  onMounted(() => {
    updateDimensions();
    window.addEventListener('resize', handleResize);
  });

  onScopeDispose(() => {
    window.removeEventListener('resize', handleResize);
    clearTimeout(resizeTimer!);
  });

  return {
    width,
    height,
    isMobile,
    isTablet,
    isDesktop,
    isLargeDesktop,
    isAbove,
    isBelow,
    isBetween,
    breakpoints,
  };
}
