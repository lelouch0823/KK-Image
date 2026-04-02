/**
 * 简单的全局状态管理 (Pub/Sub 模式)
 */

type Listener = (data: any) => void;

class Store {
    private state: Record<string, any> = {};
    private listeners: Record<string, Listener[]> = {};

    constructor() {
        this.state = {};
        this.listeners = {};
    }

    /**
     * 获取状态
     */
    get(key: string) {
        return this.state[key];
    }

    /**
     * 设置状态并触发监听器
     */
    set(key: string, value: any) {
        const oldValue = this.state[key];
        this.state[key] = value;

        // 只有值改变时才触发 (简单的引用比较)
        if (oldValue !== value) {
            this.notify(key, value);
        }
    }

    /**
     * 订阅状态变化
     */
    on(key: string, listener: Listener) {
        if (!this.listeners[key]) {
            this.listeners[key] = [];
        }
        this.listeners[key].push(listener);

        // 立即回调当前值 (可选 behavior)
        if (this.state[key] !== undefined) {
            listener(this.state[key]);
        }

        // 返回取消订阅函数
        return () => {
            this.off(key, listener);
        };
    }

    /**
     * 取消订阅
     */
    off(key: string, listener: Listener) {
        if (!this.listeners[key]) return;
        this.listeners[key] = this.listeners[key].filter(l => l !== listener);
    }

    /**
     * 触发通知
     */
    private notify(key: string, value: any) {
        if (this.listeners[key]) {
            this.listeners[key].forEach(listener => listener(value));
        }
    }

    /**
     * 批量更新
     */
    update(payload: Record<string, any>) {
        Object.keys(payload).forEach(key => {
            this.set(key, payload[key]);
        });
    }
}

export const store = new Store();

// 定义常用的 State Key
export const KEYS = {
    USER: 'user',
    TOKEN: 'token',
    LOGIN_METHOD: 'sales_login_method',
    AUTH_CONFIG: 'sales_auth_config',
    STATS: 'stats',
    NOTIFICATIONS: 'notifications',
    UNREAD_COUNT: 'unread_count',
};
