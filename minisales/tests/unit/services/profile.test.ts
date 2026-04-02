import { describe, expect, it, vi } from 'vitest';
import {
  bindSalesWechat,
  getCurrentSalesProfile,
} from '../../../miniprogram/services/sales/profile';

describe('sales profile service', () => {
  it('loads the current sales profile from GET /api/sales/:token/auth', async () => {
    const request = vi.fn().mockResolvedValue({
      success: true,
      data: { id: 'sp-1', name: 'Alice', store: 'Shanghai', phone: '13800000000' },
      error: null,
      code: null,
      status: 200,
      detail: null,
      payload: { success: true },
    });

    const result = await getCurrentSalesProfile({ accessToken: 'sales-token' }, request);

    expect(request).toHaveBeenCalledWith(
      expect.objectContaining({
        path: '/api/sales/sales-token/auth',
        method: 'GET',
      })
    );
    expect(result.data).toEqual({
      id: 'sp-1',
      name: 'Alice',
      store: 'Shanghai',
      phone: '13800000000',
    });
  });

  it('binds WeChat by exchanging wx.login code against the current sales token', async () => {
    const request = vi.fn().mockResolvedValue({
      success: true,
      data: null,
      error: null,
      code: null,
      status: 200,
      detail: null,
      payload: { success: true },
    });
    const getWechatCode = vi.fn().mockResolvedValue('wx-code-1');

    await bindSalesWechat(
      { accessToken: 'sales-token' },
      { request, getWechatCode }
    );

    expect(request).toHaveBeenCalledWith(
      expect.objectContaining({
        path: '/api/sales/sales-token/bind-wechat',
        method: 'POST',
        data: { code: 'wx-code-1' },
      })
    );
  });

  it('returns a stable failure result when wx.login does not provide a code', async () => {
    const request = vi.fn();

    const result = await bindSalesWechat(
      { accessToken: 'sales-token' },
      { request, getWechatCode: vi.fn().mockResolvedValue('') }
    );

    expect(result).toMatchObject({
      success: false,
      code: 'WECHAT_CODE_MISSING',
      error: '获取微信登录凭证失败',
    });
    expect(request).not.toHaveBeenCalled();
  });
});
