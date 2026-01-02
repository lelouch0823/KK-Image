import { ref, onMounted, onUnmounted } from 'vue';

/**
 * 响应式断点检测 Composable
 */
export function useResponsive() {
  // 断点定义（与 Tailwind 保持一致）
  const breakpoints = {
    sm: 640,
    md: 768,
    lg: 1024,
    xl: 1280,
    '2xl': 1536,
  };

  const width = ref(typeof window !== 'undefined' ? window.innerWidth : 0);
  const height = ref(typeof window !== 'undefined' ? window.innerHeight : 0);

  // 响应式布尔值
  const isMobile = ref(false);
  const isTablet = ref(false);
  const isDesktop = ref(false);
  const isLargeDesktop = ref(false);

  // 更新状态
  const updateDimensions = () => {
    width.value = window.innerWidth;
    height.value = window.innerHeight;

    isMobile.value = width.value < breakpoints.md;
    isTablet.value = width.value >= breakpoints.md && width.value < breakpoints.lg;
    isDesktop.value = width.value >= breakpoints.lg;
    isLargeDesktop.value = width.value >= breakpoints.xl;
  };

  // 检查是否满足某个断点
  const isAbove = (breakpoint) => {
    const bp = breakpoints[breakpoint];
    return bp ? width.value >= bp : false;
  };

  const isBelow = (breakpoint) => {
    const bp = breakpoints[breakpoint];
    return bp ? width.value < bp : false;
  };

  const isBetween = (minBp, maxBp) => {
    const min = breakpoints[minBp];
    const max = breakpoints[maxBp];
    if (!min || !max) return false;
    return width.value >= min && width.value < max;
  };

  // 防抖处理
  let resizeTimer = null;
  const handleResize = () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(updateDimensions, 100);
  };

  onMounted(() => {
    updateDimensions();
    window.addEventListener('resize', handleResize);
  });

  onUnmounted(() => {
    window.removeEventListener('resize', handleResize);
    clearTimeout(resizeTimer);
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
