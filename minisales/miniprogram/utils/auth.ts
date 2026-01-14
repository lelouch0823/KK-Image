/**
 * 认证工具模块
 * 处理微信登录和密码登录
 */

import { post, setToken, clearToken, getAccessToken, setAccessToken } from './api';
import { API, STORAGE_KEYS } from './constants';

interface UserInfo {
    id: string;
    name: string;
    store?: string;
}

interface LoginResult {
    success: boolean;
    user?: UserInfo;
    needBind?: boolean;
    openid?: string;
    message?: string;
}

/**
 * 微信一键登录
 * 流程: wx.login -> 获取 code -> 发送到后端 -> 获取 JWT
 */
export async function wxLogin(): Promise<LoginResult> {
    try {
        // 1. 获取微信 code
        const loginRes = await new Promise<WechatMiniprogram.LoginSuccessCallbackResult>((resolve, reject) => {
            wx.login({
                success: resolve,
                fail: reject,
            });
        });

        if (!loginRes.code) {
            return { success: false, message: '获取微信登录凭证失败' };
        }

        // 2. 发送 code 到后端
        const response = await post<{
            token?: string;
            expiresIn?: number;
            user?: UserInfo;
            needBind?: boolean;
            openid?: string;
        }>(API.WECHAT_LOGIN, { code: loginRes.code });

        if (!response.success || !response.data) {
            return { success: false, message: response.error || '登录失败' };
        }

        const data = response.data;

        // 3. 检查是否需要绑定
        if (data.needBind) {
            return {
                success: false,
                needBind: true,
                openid: data.openid,
                message: '账号未绑定微信，请使用密码登录后绑定',
            };
        }

        // 4. 保存 Token
        if (data.token) {
            setToken(data.token);
        }

        // 5. 保存用户信息
        if (data.user) {
            wx.setStorageSync(STORAGE_KEYS.USER_INFO, data.user);
        }

        return {
            success: true,
            user: data.user,
        };
    } catch (error: any) {
        console.error('WeChat login error:', error);
        return { success: false, message: error.message || '微信登录失败' };
    }
}

/**
 * 密码登录 (通过 accessToken URL)
 * @param accessToken - URL 中的 token
 * @param password - 密码
 */
export async function passwordLogin(accessToken: string, password: string): Promise<LoginResult> {
    try {
        const response = await post<{
            id: string;
            name: string;
            store?: string;
            token: string;
            expiresIn: number;
        }>(API.SALES_AUTH(accessToken), { password });

        if (!response.success || !response.data) {
            return { success: false, message: response.error || '登录失败' };
        }

        const data = response.data;

        // 保存 Token
        setToken(data.token);
        setAccessToken(accessToken);

        // 保存用户信息
        const user: UserInfo = {
            id: data.id,
            name: data.name,
            store: data.store,
        };
        wx.setStorageSync(STORAGE_KEYS.USER_INFO, user);

        return { success: true, user };
    } catch (error: any) {
        console.error('Password login error:', error);
        return { success: false, message: error.message || '登录失败' };
    }
}

/**
 * 用户名密码登录 (手机号/姓名 + 密码)
 * @param username - 手机号或姓名
 * @param password - 密码
 */
export async function usernameLogin(username: string, password: string): Promise<LoginResult> {
    try {
        const response = await post<{
            id: string;
            name: string;
            store?: string;
            token: string;
            accessToken: string;
            expiresIn: number;
        }>(API.SALES_LOGIN, { username, password });

        if (!response.success || !response.data) {
            return { success: false, message: response.error || '登录失败' };
        }

        const data = response.data;

        // 保存 Token
        setToken(data.token);
        setAccessToken(data.accessToken);

        // 保存用户信息
        const user: UserInfo = {
            id: data.id,
            name: data.name,
            store: data.store,
        };
        wx.setStorageSync(STORAGE_KEYS.USER_INFO, user);

        return { success: true, user };
    } catch (error: any) {
        console.error('Username login error:', error);
        return { success: false, message: error.message || '登录失败' };
    }
}

/**
 * 检查登录状态
 */
export async function checkAuth(): Promise<UserInfo | null> {
    const accessToken = getAccessToken();
    if (!accessToken) {
        return null;
    }

    try {
        const response = await post<UserInfo>(API.SALES_AUTH(accessToken), {});
        if (response.success && response.data) {
            wx.setStorageSync(STORAGE_KEYS.USER_INFO, response.data);
            return response.data;
        }
        return null;
    } catch {
        return null;
    }
}

/**
 * 退出登录
 */
export function logout(): void {
    clearToken();
    wx.removeStorageSync(STORAGE_KEYS.USER_INFO);
    wx.removeStorageSync(STORAGE_KEYS.ACCESS_TOKEN);
    wx.redirectTo({ url: '/pages/login/login' });
}

/**
 * 获取当前用户信息
 */
export function getCurrentUser(): UserInfo | null {
    return wx.getStorageSync(STORAGE_KEYS.USER_INFO) || null;
}

/**
 * 绑定微信
 * @param accessToken - URL 中的 token
 */
export async function bindWechat(accessToken: string): Promise<{ success: boolean; message?: string }> {
    try {
        // 获取微信 code
        const loginRes = await new Promise<WechatMiniprogram.LoginSuccessCallbackResult>((resolve, reject) => {
            wx.login({
                success: resolve,
                fail: reject,
            });
        });

        if (!loginRes.code) {
            return { success: false, message: '获取微信登录凭证失败' };
        }

        const response = await post(API.SALES_BIND_WECHAT(accessToken), { code: loginRes.code });

        if (response.success) {
            return { success: true };
        }

        return { success: false, message: response.error || '绑定失败' };
    } catch (error: any) {
        return { success: false, message: error.message || '绑定失败' };
    }
}
