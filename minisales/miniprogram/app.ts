import { getToken, getAccessToken, setAccessToken } from './utils/api';
import { fetchCurrentSalesUser } from './utils/auth';
import { clearSalesSession, restoreSalesSession } from './services/auth/session';

interface IAppOption {
  globalData: {
    userInfo: any;
  };
  restoreSession: () => Promise<void>;
}

App<IAppOption>({
  globalData: {
    userInfo: null,
  },

  onLaunch(options: WechatMiniprogram.App.LaunchShowOption) {
    // 预加载 Skyline 视图 (SOTA 性能优化)
    // @ts-ignore
    if (wx.preloadSkylineView) {
      // @ts-ignore
      wx.preloadSkylineView();
    }

    const inboundToken = options?.query?.token;
    if (typeof inboundToken === 'string' && inboundToken) {
      setAccessToken(inboundToken);
    }

    void this.restoreSession();
  },

  onShow(options: WechatMiniprogram.App.LaunchShowOption) {
    // 处理场景值 (如扫码进入)
    if (options.query && options.query.token) {
      // 从分享链接进入，保存 token
      setAccessToken(options.query.token as string);
      void this.restoreSession();
    }
  },

  async restoreSession() {
    const token = getToken();
    const accessToken = getAccessToken();

    if (!accessToken) {
      clearSalesSession({ clearAccessToken: true, redirectToLogin: true });
      return;
    }

    if (!token) {
      clearSalesSession({ redirectToLogin: true });
      return;
    }

    const restored = await restoreSalesSession({
      accessToken,
      getCurrentUser: fetchCurrentSalesUser,
    });

    if (!restored.ok) {
      clearSalesSession({ redirectToLogin: true });
    }
  },
});
