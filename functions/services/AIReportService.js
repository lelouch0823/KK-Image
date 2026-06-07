/**
 * AI 报告生成服务
 * 封装 /report 端点的数据聚合和报告生成逻辑
 * @module services/AIReportService
 */

import { OrderStatsRepository } from '../repositories/OrderStatsRepository.js';
import { SystemStatsRepository } from '../repositories/SystemStatsRepository.js';
import { callAIAuto } from '../utils/ai-utils.js';
import { DateUtils } from '../api/utils/date.js';

/**
 * 报告生成的 System Prompt
 */
const REPORT_SYSTEM_PROMPT = (date, toolResults) => `
你是一个专业的报告生成 AI。根据以下数据生成一份精美的 HTML 报告。

当前日期：${date}

**可用数据**：
${JSON.stringify(toolResults, null, 2)}

**要求**：
1. 生成一个完整的 HTML 文档（包含 <!DOCTYPE html>、<html>、<head>、<body>）
2. 在 <head> 中引入 Chart.js CDN：<script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
3. 使用内联 CSS 美化页面，设计要求：
   - 最大宽度 1200px，居中显示
   - 使用系统字体 (system-ui)
   - 卡片式布局，圆角 + 阴影
   - 主色调：#6366f1（靛蓝色）
4. 用 <canvas> 和 Chart.js 渲染图表：
   - 订单趋势用折线图或柱状图
   - 文件类型分布用饼图或环形图
   - 销售排行用水平柱状图
5. 用 HTML <table> 展示待处理订单列表
6. 在页面顶部显示报告标题和生成时间
7. 只输出 HTML 代码，不要输出其他任何内容

生成的 HTML 应该是一个完整的、可直接在浏览器中打开的网页。
`;

export class AIReportService {
  /**
   * @param {Object} db - D1 数据库实例
   * @param {Object} [deps={}] - 依赖注入
   * @param {OrderStatsRepository} [deps.orderStatsRepo]
   * @param {SystemStatsRepository} [deps.systemStatsRepo]
   */
  constructor(db, deps = {}) {
    this.orderStatsRepo = deps.orderStatsRepo || new OrderStatsRepository(db);
    this.systemStatsRepo = deps.systemStatsRepo || new SystemStatsRepository(db);
  }

  /**
   * 生成 AI 报告
   * @param {Object} runtimeEnv - AI 运行时配置
   * @returns {Promise<string>} 清理后的 HTML 内容
   */
  async generateReport(runtimeEnv) {
    const toolResults = await this._aggregateReportData();
    const todayDate = new Date().toLocaleDateString('zh-CN', { timeZone: 'Asia/Shanghai' });
    const messages = [
      { role: 'system', content: REPORT_SYSTEM_PROMPT(todayDate, toolResults) },
      { role: 'user', content: '请根据以上数据生成完整的 HTML 报告。' },
    ];

    const result = await callAIAuto({ messages, tools: [], env: runtimeEnv, preferStream: true });
    let cleanHtml = result.content || '';

    // 清理 Markdown 代码块
    cleanHtml = cleanHtml.replace(/^```html\n?|```$/g, '').trim();

    return cleanHtml;
  }

  /**
   * 聚合报告所需数据
   * @private
   * @returns {Promise<Object>} 聚合后的统计数据
   */
  async _aggregateReportData() {
    const todayStart = DateUtils.getChinaDayStart();
    const weekStart = todayStart - 6 * 24 * 60 * 60 * 1000;
    const monthStart = todayStart - 29 * 24 * 60 * 60 * 1000;

    const [orderStats, pendingOrders, customerStats, spaceStats, salespersonStats, fileStats] =
      await Promise.all([
        this.orderStatsRepo.getAdminStats(todayStart, weekStart, monthStart),
        this.orderStatsRepo.getRecentPending(5),
        this.systemStatsRepo.getCustomerStats(),
        this.systemStatsRepo.getSpaceStats(),
        this.systemStatsRepo.getSalespersonStats(),
        this.systemStatsRepo.getFileStats(),
      ]);

    return { orderStats, pendingOrders, customerStats, spaceStats, salespersonStats, fileStats };
  }
}

/**
 * 创建 AIReportService 实例（工厂函数）
 * @param {Object} db - D1 数据库实例
 * @returns {AIReportService}
 */
export function createAIReportService(db, deps = {}) {
  return new AIReportService(db, deps);
}
