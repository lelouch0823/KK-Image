import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { nextTick } from 'vue';

// 需要模拟 onMounted 和 onScopeDispose，因为 useResponsive 在 composable 中注册生命周期
// 使用 mount 从 @vue/test-utils 来触发 onMounted
import { mount } from '@vue/test-utils';
import { defineComponent } from 'vue';

describe('useResponsive', () => {
  let originalInnerWidth;
  let originalInnerHeight;
  let originalAddEventListener;
  let originalRemoveEventListener;

  beforeEach(() => {
    originalInnerWidth = window.innerWidth;
    originalInnerHeight = window.innerHeight;
    originalAddEventListener = window.addEventListener;
    originalRemoveEventListener = window.removeEventListener;
  });

  afterEach(() => {
    Object.defineProperty(window, 'innerWidth', { value: originalInnerWidth, writable: true });
    Object.defineProperty(window, 'innerHeight', { value: originalInnerHeight, writable: true });
    window.addEventListener = originalAddEventListener;
    window.removeEventListener = originalRemoveEventListener;
  });

  function setWindowSize(width, height = 800) {
    Object.defineProperty(window, 'innerWidth', { value: width, writable: true, configurable: true });
    Object.defineProperty(window, 'innerHeight', { value: height, writable: true, configurable: true });
  }

  async function mountWithResponsive() {
    const { useResponsive } = await import('../useResponsive');
    let responsive;

    const wrapper = mount(
      defineComponent({
        setup() {
          responsive = useResponsive();
          return responsive;
        },
        template: '<div />',
      })
    );

    await nextTick();
    return { responsive, wrapper };
  }

  it('初始断点应根据当前窗口宽度正确设置', async () => {
    setWindowSize(500); // 小于 md(768) => mobile
    const { responsive } = await mountWithResponsive();

    expect(responsive.isMobile.value).toBe(true);
    expect(responsive.isTablet.value).toBe(false);
    expect(responsive.isDesktop.value).toBe(false);
    expect(responsive.isLargeDesktop.value).toBe(false);
  });

  it('中等屏幕应识别为 tablet', async () => {
    setWindowSize(800); // >= md(768), < lg(1024) => tablet
    const { responsive } = await mountWithResponsive();

    expect(responsive.isMobile.value).toBe(false);
    expect(responsive.isTablet.value).toBe(true);
    expect(responsive.isDesktop.value).toBe(false);
  });

  it('大屏幕应识别为 desktop', async () => {
    setWindowSize(1100); // >= lg(1024), < xl(1280) => desktop
    const { responsive } = await mountWithResponsive();

    expect(responsive.isMobile.value).toBe(false);
    expect(responsive.isTablet.value).toBe(false);
    expect(responsive.isDesktop.value).toBe(true);
    expect(responsive.isLargeDesktop.value).toBe(false);
  });

  it('超大屏幕应识别为 largeDesktop', async () => {
    setWindowSize(1400); // >= xl(1280) => largeDesktop
    const { responsive } = await mountWithResponsive();

    expect(responsive.isDesktop.value).toBe(true);
    expect(responsive.isLargeDesktop.value).toBe(true);
  });

  it('isAbove 应正确判断是否在断点之上', async () => {
    setWindowSize(900);
    const { responsive } = await mountWithResponsive();

    expect(responsive.isAbove('sm')).toBe(true);  // 900 >= 640
    expect(responsive.isAbove('md')).toBe(true);  // 900 >= 768
    expect(responsive.isAbove('lg')).toBe(false); // 900 < 1024
  });

  it('isBelow 应正确判断是否在断点之下', async () => {
    setWindowSize(900);
    const { responsive } = await mountWithResponsive();

    expect(responsive.isBelow('lg')).toBe(true);  // 900 < 1024
    expect(responsive.isBelow('md')).toBe(false); // 900 >= 768
  });

  it('isBetween 应正确判断是否在两个断点之间', async () => {
    setWindowSize(900);
    const { responsive } = await mountWithResponsive();

    expect(responsive.isBetween('md', 'lg')).toBe(true);   // 768 <= 900 < 1024
    expect(responsive.isBetween('sm', 'md')).toBe(false);  // 900 >= 768
    expect(responsive.isBetween('lg', 'xl')).toBe(false);  // 900 < 1024
  });

  it('window resize 时应更新断点状态', async () => {
    setWindowSize(500); // 初始 mobile
    const { responsive } = await mountWithResponsive();
    expect(responsive.isMobile.value).toBe(true);

    // 模拟 resize
    setWindowSize(1100);
    // 触发 resize 事件
    window.dispatchEvent(new Event('resize'));

    // 等待防抖（100ms）+ nextTick
    await new Promise((r) => setTimeout(r, 150));
    await nextTick();

    expect(responsive.isMobile.value).toBe(false);
    expect(responsive.isDesktop.value).toBe(true);
  });

  it('width 和 height 应反映窗口尺寸', async () => {
    setWindowSize(1024, 768);
    const { responsive } = await mountWithResponsive();

    expect(responsive.width.value).toBe(1024);
    expect(responsive.height.value).toBe(768);
  });

  it('应包含所有断点定义', async () => {
    setWindowSize(1024);
    const { responsive } = await mountWithResponsive();

    expect(responsive.breakpoints).toBeDefined();
    expect(responsive.breakpoints.sm).toBe(640);
    expect(responsive.breakpoints.md).toBe(768);
    expect(responsive.breakpoints.lg).toBe(1024);
    expect(responsive.breakpoints.xl).toBe(1280);
    expect(responsive.breakpoints['2xl']).toBe(1536);
  });
});
