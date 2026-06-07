/**
 * 邮件通知服务 (Email Notification Service)
 * ===========================================
 *
 * 使用 Cloudflare Email Workers 发送邮件通知。
 * 当前实现为模拟版本，实际部署时需配置 Cloudflare Email Routing。
 *
 * 环境变量配置:
 *   EMAIL_FROM - 发件人地址 (如: noreply@your-domain.com)
 *   EMAIL_ENABLED - 是否启用邮件发送 (true/false)
 *
 * @module services/EmailService
 */

import { SettingsRepository } from '../repositories/SettingsRepository.js';

/**
 * 格式化订单确认邮件内容
 */
function buildOrderConfirmationEmail(order = {}) {
  const orderNo = order.orderNo || order.id || '';
  const status = order.status || 'pending';
  const quantity = order.quantity || 0;
  const createdAt = order.createdAt
    ? new Date(order.createdAt).toLocaleString('zh-CN')
    : new Date().toLocaleString('zh-CN');

  const statusLabels = {
    pending: '待处理',
    confirmed: '已确认',
    rejected: '已驳回',
    production: '生产中',
    shipping: '在途',
    arrived: '已到货',
    fulfilled: '履约完成',
    delivered: '已交付',
    void: '已作废',
  };

  return {
    subject: `[kk-life] 订单 ${orderNo} 状态更新 - ${statusLabels[status] || status}`,
    html: `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 24px; border-radius: 12px 12px 0 0;">
    <h1 style="color: white; margin: 0; font-size: 20px;">订单状态通知</h1>
  </div>
  <div style="background: #f9fafb; padding: 24px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px;">
    <p>您好，您的订单状态已更新：</p>
    <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
      <tr>
        <td style="padding: 8px 12px; background: #f3f4f6; border-radius: 4px; font-weight: 500; width: 100px;">订单编号</td>
        <td style="padding: 8px 12px;">${orderNo}</td>
      </tr>
      <tr><td colspan="2" style="height: 8px;"></td></tr>
      <tr>
        <td style="padding: 8px 12px; background: #f3f4f6; border-radius: 4px; font-weight: 500;">当前状态</td>
        <td style="padding: 8px 12px;"><strong>${statusLabels[status] || status}</strong></td>
      </tr>
      <tr><td colspan="2" style="height: 8px;"></td></tr>
      <tr>
        <td style="padding: 8px 12px; background: #f3f4f6; border-radius: 4px; font-weight: 500;">数量</td>
        <td style="padding: 8px 12px;">${quantity}</td>
      </tr>
      <tr><td colspan="2" style="height: 8px;"></td></tr>
      <tr>
        <td style="padding: 8px 12px; background: #f3f4f6; border-radius: 4px; font-weight: 500;">时间</td>
        <td style="padding: 8px 12px;">${createdAt}</td>
      </tr>
    </table>
    <p style="margin-top: 20px; color: #6b7280; font-size: 13px;">
      此邮件由系统自动发送，请勿直接回复。
    </p>
  </div>
</body>
</html>`,
    text: `订单 ${orderNo} 状态更新\n\n当前状态: ${statusLabels[status] || status}\n数量: ${quantity}\n时间: ${createdAt}\n\n此邮件由系统自动发送。`,
  };
}

export class EmailService {
  constructor(env, deps = {}) {
    this.env = env;
    this.settingsRepo = deps.settingsRepo || (env.DB ? new SettingsRepository(env.DB) : null);
    this.fetch = deps.fetch || globalThis.fetch?.bind(globalThis);
  }

  /**
   * 获取邮件配置
   * @returns {Promise<{enabled: boolean, from: string}>}
   */
  async getConfig() {
    try {
      if (!this.settingsRepo) {
        return {
          enabled: this.env.EMAIL_ENABLED === 'true',
          from: this.env.EMAIL_FROM || '',
        };
      }

      const grouped = await this.settingsRepo.getAllGrouped();
      const emailSettings = grouped?.email || {};

      return {
        enabled: emailSettings.EMAIL_ENABLED !== 'false' && emailSettings.EMAIL_ENABLED !== '',
        from: emailSettings.EMAIL_FROM || this.env.EMAIL_FROM || '',
      };
    } catch {
      return {
        enabled: this.env.EMAIL_ENABLED === 'true',
        from: this.env.EMAIL_FROM || '',
      };
    }
  }

  /**
   * 发送订单确认邮件
   * @param {string} to - 收件人邮箱
   * @param {object} order - 订单数据
   * @returns {Promise<{success: boolean, error?: string}>}
   */
  async sendOrderConfirmation(to, order) {
    const config = await this.getConfig();

    if (!config.enabled) {
      return { success: false, error: 'email_disabled' };
    }

    if (!config.from) {
      return { success: false, error: 'no_sender_configured' };
    }

    if (!to) {
      return { success: false, error: 'no_recipient' };
    }

    const email = buildOrderConfirmationEmail(order);

    try {
      // Cloudflare Email Workers 方式
      if (this.env.EmailMessage) {
        // 实际的 Email Worker 处理需要在 wrangler.toml 中配置 email 路由
        // new this.env.EmailMessage(from, to, { subject, html, text })
        return { success: true };
      }

      // 模拟模式（开发环境）
      return { success: true, mock: true };
    } catch (err) {
      console.error('[EmailService] Send failed:', err);
      return { success: false, error: String(err?.message || err || 'send_failed') };
    }
  }

  /**
   * 通用邮件发送
   * @param {string} to - 收件人
   * @param {string} subject - 主题
   * @param {string} html - HTML 内容
   * @param {string} text - 纯文本内容
   * @returns {Promise<{success: boolean, error?: string}>}
   */
  async send(to, subject, html, text) {
    const config = await this.getConfig();

    if (!config.enabled) {
      return { success: false, error: 'email_disabled' };
    }

    try {
      if (this.env.EmailMessage) {
        // new this.env.EmailMessage(from, to, { subject, html, text })
        return { success: true };
      }

      return { success: true, mock: true };
    } catch (err) {
      console.error('[EmailService] Send failed:', err);
      return { success: false, error: String(err?.message || err || 'send_failed') };
    }
  }
}
