/**
 * Webhook 通知服务 (WeChat/DingTalk Notifications)
 * ==================================================
 *
 * 支持向企业微信、钉钉等 webhook 渠道发送通知消息。
 * 当关键事件（如新订单、状态变更）发生时，自动推送到配置的 webhook URL。
 *
 * @module services/WebhookNotificationService
 */

import { SettingsRepository } from '../repositories/SettingsRepository.js';

/**
 * 支持的 webhook 渠道类型
 */
const CHANNEL_CONFIGS = {
  wechat_work: {
    name: '企业微信',
    buildBody: (message) => ({
      msgtype: 'markdown',
      markdown: {
        content: message,
      },
    }),
  },
  dingtalk: {
    name: '钉钉',
    buildBody: (message) => ({
      msgtype: 'markdown',
      markdown: {
        title: '系统通知',
        text: message,
      },
    }),
  },
  feishu: {
    name: '飞书',
    buildBody: (message) => ({
      msg_type: 'interactive',
      card: {
        header: {
          title: { tag: 'plain_text', content: '系统通知' },
          template: 'blue',
        },
        elements: [
          {
            tag: 'markdown',
            content: message,
          },
        ],
      },
    }),
  },
  generic: {
    name: '通用 Webhook',
    buildBody: (message) => ({
      text: message,
      timestamp: Date.now(),
    }),
  },
};

/**
 * 将事件数据格式化为 Markdown 消息
 */
function formatEventMessage(eventType, payload = {}) {
  const templates = {
    order_created: (p) =>
      `**新订单通知**\n> 订单编号：${p.order_no || p.order_id}\n> 提交人：${p.salesperson_name || '未知'}\n> 时间：${new Date().toLocaleString('zh-CN')}`,

    order_status_changed_by_admin: (p) =>
      `**订单状态变更**\n> 订单编号：${p.order_no || p.order_id}\n> 状态：${p.status}\n> 操作人：${p.actor_name || '管理员'}`,

    order_comment_created_by_admin: (p) =>
      `**订单新留言**\n> 订单编号：${p.order_no || p.order_id}\n> 留言人：${p.actor_name || '管理员'}\n> 内容：${p.comment || ''}`,

    order_delivery_confirmed: (p) =>
      `**订单签收确认**\n> 订单编号：${p.order_no || p.order_id}\n> 确认人：${p.actor_name || '管理员'}`,

    admin_notification_created: (p) =>
      `**系统通知**\n> ${p.title}\n> ${p.content || ''}`,
  };

  const formatter = templates[eventType];
  if (formatter) {
    return formatter(payload);
  }

  // 通用格式
  return `**${eventType}**\n> ${JSON.stringify(payload, null, 2).slice(0, 500)}`;
}

export class WebhookNotificationService {
  constructor(db, deps = {}) {
    this.db = db;
    this.settingsRepo = deps.settingsRepo || new SettingsRepository(db);
    this.fetch = deps.fetch || globalThis.fetch?.bind(globalThis);
  }

  /**
   * 获取已配置的通知 webhook 列表
   * @returns {Promise<Array<{channel: string, url: string, enabled: boolean}>>}
   */
  async getConfiguredChannels() {
    try {
      const grouped = await this.settingsRepo.getAllGrouped();
      const notifications = grouped?.notifications || {};
      const channels = [];

      for (const [channelCode, config] of Object.entries(CHANNEL_CONFIGS)) {
        const urlKey = `NOTIFY_WEBHOOK_${channelCode.toUpperCase()}_URL`;
        const enabledKey = `NOTIFY_WEBHOOK_${channelCode.toUpperCase()}_ENABLED`;
        const url = notifications[urlKey] || '';
        const enabled = notifications[enabledKey] !== 'false';

        if (url) {
          channels.push({
            channel: channelCode,
            channelName: config.name,
            url,
            enabled,
          });
        }
      }

      return channels;
    } catch {
      return [];
    }
  }

  /**
   * 发送通知到所有已启用的 webhook 渠道
   * @param {string} eventType - 事件类型
   * @param {object} payload - 事件数据
   * @returns {Promise<Array<{channel: string, success: boolean, error?: string}>>}
   */
  async notify(eventType, payload = {}) {
    const channels = await this.getConfiguredChannels();
    const results = [];

    for (const ch of channels) {
      if (!ch.enabled) {
        results.push({ channel: ch.channel, success: false, error: 'disabled' });
        continue;
      }

      try {
        const config = CHANNEL_CONFIGS[ch.channel] || CHANNEL_CONFIGS.generic;
        const message = formatEventMessage(eventType, payload);
        const body = config.buildBody(message);

        const response = await this.fetch(ch.url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(10000),
        });

        results.push({
          channel: ch.channel,
          success: response.ok,
          error: response.ok ? undefined : `HTTP ${response.status}`,
        });
      } catch (err) {
        results.push({
          channel: ch.channel,
          success: false,
          error: String(err?.message || err || 'network error'),
        });
      }
    }

    return results;
  }

  /**
   * 获取支持的渠道列表
   * @returns {Array<{code: string, name: string}>}
   */
  getSupportedChannels() {
    return Object.entries(CHANNEL_CONFIGS).map(([code, config]) => ({
      code,
      name: config.name,
    }));
  }
}
