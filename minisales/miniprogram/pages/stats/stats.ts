import { get, getAccessToken } from '../../utils/api';
import { API } from '../../utils/constants';
import { getCurrentUser } from '../../utils/auth';
import { calculateNavBarHeight, initTabBar } from '../../utils/ui-helpers';

interface Stats {
    totalOrders: number;
    completedOrders: number;
    monthOrders: number;
    monthlyTrend: Array<{ date: string; count: number }>;
}

Page({
    data: {
        stats: {
            totalOrders: 0,
            completedOrders: 0,
            monthOrders: 0,
            monthlyTrend: [],
        } as Stats,
        loading: true,
        user: null as { name: string; store?: string } | null,
        maxCount: 1,
        chartLabels: [] as string[], // X 轴标签

        // 导航栏布局信息
        statusBarHeight: 20,
        navContentHeight: 44,
        headerHeight: 64,
        // Skeleton 配置
        statsRowCol: [
            { width: '100%', height: '320rpx', borderRadius: '16rpx' },
            { width: '100%', height: '480rpx', borderRadius: '16rpx', marginTop: '32rpx' },
        ],
    },

    onLoad() {
        const user = getCurrentUser();
        this.setData({ user });

        // 使用统一的 UI Helper 计算高度
        const { statusBarHeight, navContentHeight, totalHeight } = calculateNavBarHeight();

        this.setData({
            statusBarHeight,
            navContentHeight,
            headerHeight: totalHeight,
        });
    },

    onShow() {
        initTabBar(this);
        this.loadStats();
    },

    /**
     * 下拉刷新
     */
    async onPullDownRefresh() {
        await this.loadStats();
        wx.stopPullDownRefresh();
    },

    /**
     * 加载统计数据
     */
    async loadStats() {
        const accessToken = getAccessToken();
        if (!accessToken) return;

        this.setData({ loading: true });

        try {
            const response = await get<Stats>(API.SALES_STATS(accessToken));

            if (response.success && response.data) {
                const stats = response.data;
                const maxCount = Math.max(...stats.monthlyTrend.map((d) => d.count), 1);

                // 生成 X 轴标签 (只显示部分日期)
                const chartLabels = stats.monthlyTrend.map((d, i) => {
                    // 只显示第一个、最后一个和中间位置
                    if (i === 0 || i === stats.monthlyTrend.length - 1 || i === Math.floor(stats.monthlyTrend.length / 2)) {
                        return d.date.substring(5); // MM-DD
                    }
                    return '';
                });

                this.setData({ stats, maxCount, chartLabels });

                // 延迟绘制图表 (等待 Canvas 渲染)
                setTimeout(() => this.drawChart(), 100);
            }
        } catch (error) {
            console.error('Load stats failed:', error);
        } finally {
            this.setData({ loading: false });
        }
    },

    /**
     * 绘制折线图
     */
    drawChart() {
        const query = wx.createSelectorQuery();
        query.select('#trendChart')
            .fields({ node: true, size: true })
            .exec((res) => {
                if (!res || !res[0] || !res[0].node) {
                    console.error('Canvas not found');
                    return;
                }

                const canvas = res[0].node;
                const ctx = canvas.getContext('2d');
                const dpr = wx.getSystemInfoSync().pixelRatio;
                const width = res[0].width;
                const height = res[0].height;

                // 设置 Canvas 分辨率
                canvas.width = width * dpr;
                canvas.height = height * dpr;
                ctx.scale(dpr, dpr);

                // 清空画布
                ctx.clearRect(0, 0, width, height);

                const { stats, maxCount } = this.data;
                const data = stats.monthlyTrend.map(d => d.count);
                if (data.length === 0) return;

                // 图表边距
                const padding = { top: 20, right: 20, bottom: 30, left: 10 };
                const chartWidth = width - padding.left - padding.right;
                const chartHeight = height - padding.top - padding.bottom;

                // 计算点坐标
                const points: { x: number; y: number }[] = data.map((value, index) => ({
                    x: padding.left + (index / (data.length - 1 || 1)) * chartWidth,
                    y: padding.top + chartHeight - (value / maxCount) * chartHeight,
                }));

                // 绘制渐变填充
                const gradient = ctx.createLinearGradient(0, padding.top, 0, height - padding.bottom);
                gradient.addColorStop(0, 'rgba(59, 130, 246, 0.3)');
                gradient.addColorStop(1, 'rgba(59, 130, 246, 0.0)');

                ctx.beginPath();
                ctx.moveTo(points[0].x, height - padding.bottom);
                points.forEach((p) => ctx.lineTo(p.x, p.y));
                ctx.lineTo(points[points.length - 1].x, height - padding.bottom);
                ctx.closePath();
                ctx.fillStyle = gradient;
                ctx.fill();

                // 绘制折线
                ctx.beginPath();
                ctx.moveTo(points[0].x, points[0].y);
                for (let i = 1; i < points.length; i++) {
                    // 使用贝塞尔曲线平滑
                    const xc = (points[i].x + points[i - 1].x) / 2;
                    const yc = (points[i].y + points[i - 1].y) / 2;
                    ctx.quadraticCurveTo(points[i - 1].x, points[i - 1].y, xc, yc);
                }
                // 最后一段
                ctx.lineTo(points[points.length - 1].x, points[points.length - 1].y);
                ctx.strokeStyle = '#3b82f6';
                ctx.lineWidth = 2;
                ctx.stroke();

                // 绘制数据点
                points.forEach((p, i) => {
                    ctx.beginPath();
                    ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
                    ctx.fillStyle = '#ffffff';
                    ctx.fill();
                    ctx.strokeStyle = '#3b82f6';
                    ctx.lineWidth = 2;
                    ctx.stroke();

                    // 在最后一个点上显示数值
                    if (i === points.length - 1) {
                        ctx.fillStyle = '#3b82f6';
                        ctx.font = 'bold 12px sans-serif';
                        ctx.textAlign = 'center';
                        ctx.fillText(String(data[i]), p.x, p.y - 10);
                    }
                });
            });
    },

    /**
     * 计算柱形高度百分比 (保留兼容)
     */
    getBarHeight(count: number): string {
        const { maxCount } = this.data;
        return `${Math.max(10, (count / maxCount) * 100)}%`;
    },

    handleBack() {
        wx.navigateBack({
            fail: () => {
                wx.switchTab({ url: '/pages/index/index' });
            },
        });
    },
});
