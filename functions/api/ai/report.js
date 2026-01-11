/**
 * AI 报告生成 API (Admin Only)
 * POST /api/ai/report
 * 
 * 生成完整的 HTML 报告，包含图表和表格。
 * 返回完整的 HTML 字符串，可在新窗口中渲染。
 */
import { authenticateAdmin } from '../utils/auth.js';
import { OrderStatsRepository } from '../../repositories/OrderStatsRepository.js';
import { SystemStatsRepository } from '../../repositories/SystemStatsRepository.js';
import { callAI } from '../../utils/ai-utils.js';
import { DateUtils } from '../utils/date.js';
import { success, error } from '../utils/response.js';

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

/**
 * 收集所有统计数据
 */
async function collectAllStats(env) {
    const orderStatsRepo = new OrderStatsRepository(env.DB);
    const systemStatsRepo = new SystemStatsRepository(env.DB);

    const todayStart = DateUtils.getChinaDayStart();
    const weekStart = todayStart - 6 * 24 * 60 * 60 * 1000;
    const monthStart = todayStart - 29 * 24 * 60 * 60 * 1000;

    const [orderStats, pendingOrders, customerStats, spaceStats, salespersonStats, fileStats] = await Promise.all([
        orderStatsRepo.getAdminStats(todayStart, weekStart, monthStart),
        orderStatsRepo.getRecentPending(5),
        systemStatsRepo.getCustomerStats(),
        systemStatsRepo.getSpaceStats(),
        systemStatsRepo.getSalespersonStats(),
        systemStatsRepo.getFileStats()
    ]);

    return {
        orderStats,
        pendingOrders,
        customerStats,
        spaceStats,
        salespersonStats,
        fileStats
    };
}

export async function onRequestPost(context) {
    const { env, request } = context;

    try {
        // 1. 权限验证
        await authenticateAdmin(request, env);

        // 2. 收集所有统计数据
        const toolResults = await collectAllStats(env);

        // 3. 生成报告
        const todayDate = new Date().toLocaleDateString('zh-CN', { timeZone: 'Asia/Shanghai' });
        const messages = [
            { role: 'system', content: REPORT_SYSTEM_PROMPT(todayDate, toolResults) },
            { role: 'user', content: '请根据以上数据生成完整的 HTML 报告。' }
        ];

        const response = await callAI(messages, [], env);
        const htmlContent = response.choices[0]?.message?.content || '';

        // 4. 清理 HTML（移除可能的 markdown 代码块标记）
        let cleanHtml = htmlContent;
        if (cleanHtml.startsWith('```html')) {
            cleanHtml = cleanHtml.slice(7);
        } else if (cleanHtml.startsWith('```')) {
            cleanHtml = cleanHtml.slice(3);
        }
        if (cleanHtml.endsWith('```')) {
            cleanHtml = cleanHtml.slice(0, -3);
        }
        cleanHtml = cleanHtml.trim();

        return success({ html: cleanHtml });
    } catch (err) {
        console.error('[AI Report] Error:', err);
        return error(err.message, 500);
    }
}
