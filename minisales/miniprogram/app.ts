import { getToken, getAccessToken } from './utils/api';
import { fetchCurrentSalesUser } from './utils/auth';
import { applyInboundAccessToken, clearSalesSession, restoreSalesSession } from './services/auth/session';
import { KEYS, store } from './utils/store';
import { requestSubscribeAuth, SUBSCRIBE_TEMPLATES } from './services/sales/push';

interface IAppOption {
  globalData: {
    userInfo: any;
  };
  restoreSession: () => Promise<void>;
  initSubscribeMessages: () => Promise<void>;
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
    applyInboundAccessToken(typeof inboundToken === 'string' ? inboundToken : null);

    void this.restoreSession();
    void this.initSubscribeMessages();
  },

  onShow(options: WechatMiniprogram.App.LaunchShowOption) {
    // 处理场景值 (如扫码进入)
    if (options.query && options.query.token) {
      applyInboundAccessToken(options.query.token as string);
      void this.restoreSession();
    }
  },

  async initSubscribeMessages() {
    const templateIds = Object.values(SUBSCRIBE_TEMPLATES).filter(Boolean);
    if (templateIds.length === 0) {
      return;
    }

    // 静默请求订阅授权，不阻塞启动
    await requestSubscribeAuth(templateIds);
  },

  async restoreSession() {
    store.set(KEYS.SESSION_RESTORE, 'in_progress');

    const token = getToken();
    const accessToken = getAccessToken();

    if (!accessToken) {
      store.set(KEYS.SESSION_RESTORE, 'expired');
      clearSalesSession({ clearAccessToken: true, redirectToLogin: true });
      return;
    }

    if (!token) {
      store.set(KEYS.SESSION_RESTORE, 'expired');
      clearSalesSession({ redirectToLogin: true });
      return;
    }

    const restored = await restoreSalesSession({
      accessToken,
      getCurrentUser: fetchCurrentSalesUser,
    });

    if (!restored.ok && restored.expired) {
      store.set(KEYS.SESSION_RESTORE, 'expired');
      clearSalesSession({ redirectToLogin: true });
      return;
    }

    store.set(KEYS.SESSION_RESTORE, restored.ok ? 'ready' : 'transient_failed');
  },
});
