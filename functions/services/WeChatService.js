/**
 * 微信 API 服务
 * 封装微信 jscode2session 调用，避免多处重复
 */

/**
 * 通过微信 code 换取 openid
 * @param {{ WECHAT_APPID?: string, WECHAT_SECRET?: string }} env
 * @param {string} code - 微信登录 code
 * @returns {Promise<{ openid: string, session_key: string, unionid?: string }>}
 * @throws {Error} 微信未配置或 API 调用失败
 */
export async function getWeChatOpenid(env, code) {
  if (!env.WECHAT_APPID || !env.WECHAT_SECRET) {
    throw new Error('微信登录未配置');
  }

  const wxParams = new URLSearchParams({
    appid: env.WECHAT_APPID,
    secret: env.WECHAT_SECRET,
    js_code: code,
    grant_type: 'authorization_code',
  });
  const wxUrl = `https://api.weixin.qq.com/sns/jscode2session?${wxParams}`;
  const wxRes = await fetch(wxUrl, {
    signal: AbortSignal.timeout(10000), // 10秒超时保护
  });
  const wxData = await wxRes.json();

  if (wxData.errcode) {
    console.error('[WeChat] API error:', wxData.errcode, wxData.errmsg);
    throw new Error(wxData.errmsg || '微信登录失败，请稍后重试');
  }

  return wxData;
}
