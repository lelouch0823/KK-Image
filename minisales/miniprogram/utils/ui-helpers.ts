/**
 * UI 辅助函数
 */

/**
 * 计算自定义导航栏高度
 * @returns { navContentHeight, statusBarHeight, totalHeight }
 */
export function calculateNavBarHeight() {
    const sysInfo = wx.getSystemInfoSync();
    const menuInfo = wx.getMenuButtonBoundingClientRect();

    const statusBarHeight = sysInfo.statusBarHeight || 20;
    // 导航栏内容高度 = (胶囊顶部 - 状态栏高度) * 2 + 胶囊高度
    const navContentHeight = (menuInfo.top - statusBarHeight) * 2 + menuInfo.height;

    return {
        statusBarHeight,
        navContentHeight,
        totalHeight: statusBarHeight + navContentHeight,
    };
}

/**
 * 判断是否需要切换导航栏可见性
 * @param scrollTop 当前滚动位置
 * @param lastScrollTop 上次滚动位置
 * @param currentVisible 当前是否可见
 * @param navBarHeight 导航栏高度 (用于顶部始终显示判断)
 * @param threshold 滚动阈值 (默认 10)
 * @returns boolean | null (null 表示无需改变, true 显示, false 隐藏)
 */
export function getNavbarVisibility(
    scrollTop: number,
    lastScrollTop: number,
    currentVisible: boolean,
    navBarHeight: number,
    threshold: number = 10
): boolean | null {
    // 顶部始终显示
    if (scrollTop < navBarHeight + 20) {
        return currentVisible ? null : true;
    }

    const delta = scrollTop - lastScrollTop;

    if (Math.abs(delta) < threshold) return null;

    // 向下滚动 -> 隐藏
    if (delta > 0 && currentVisible) {
        return false;
    }
    // 向上滚动 -> 显示
    else if (delta < 0 && !currentVisible) {
        return true;
    }

    return null;
}

/**
 * 初始化 TabBar (用于 onShow)
 * @param pageCtx 页面上下文 (this)
 */
export function initTabBar(pageCtx: any) {
    if (typeof pageCtx.getTabBar === 'function' && pageCtx.getTabBar()) {
        const tabBar = pageCtx.getTabBar();
        if (tabBar && typeof tabBar.init === 'function') {
            tabBar.init();
        }
    }
}
