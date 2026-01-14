import { getToken, getAccessToken, setAccessToken } from './utils/api';

interface IAppOption {
  globalData: {
    userInfo: any;
  }
}

App<IAppOption>({
  globalData: {
    userInfo: null,
  },

  onLaunch() {
    // 预加载 Skyline 视图 (SOTA 性能优化)
    // @ts-ignore
    if (wx.preloadSkylineView) {
      // @ts-ignore
      wx.preloadSkylineView();
    }

    // 检查登录状态
    const token = getToken();
    const accessToken = getAccessToken();

    if (!token || !accessToken) {
      // 未登录，跳转登录页
      wx.redirectTo({ url: '/pages/login/login' });
    }
  },

  onShow(options) {
    // 处理场景值 (如扫码进入)
    if (options.query && options.query.token) {
      // 从分享链接进入，保存 token
      setAccessToken(options.query.token as string);
    }
  },
});