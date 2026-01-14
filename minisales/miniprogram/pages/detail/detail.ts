/**
 * 订单详情页
 */

import { get, post, getAccessToken } from '../../utils/api';
import { API, STATUS_CONFIG, OrderStatus } from '../../utils/constants';

interface OrderDetail {
    id: string;
    orderNo: string;
    status: OrderStatus;
    currentData: {
        name?: string;
        brand?: string;
        series?: string;
        size?: string;
        color?: string;
        material?: string;
        remark?: string;
        deadline?: string;
    };
    files: Array<{
        id: string;
        name: string;
        url: string;
        mimeType?: string;
    }>;
    timeline: Array<{
        id: string;
        actionType: string;
        actorType: string;
        actorName?: string;
        comment?: string;
        fieldName?: string;
        oldValue?: string;
        newValue?: string;
        reason?: string;
        createdAt: number;
    }>;
    createdAt: number;
    updatedAt: number;
}

Page({
    data: {
        order: null as OrderDetail | null,
        loading: true,
        statusConfig: STATUS_CONFIG,
        comment: '',
        submittingComment: false,
    },

    onLoad(options: { id: string }) {
        if (options.id) {
            this.loadOrder(options.id);
        }
    },

    /**
     * 加载订单详情
     */
    async loadOrder(orderId: string) {
        const accessToken = getAccessToken();
        if (!accessToken) return;

        this.setData({ loading: true });

        try {
            const response = await get<OrderDetail>(API.SALES_ORDER_DETAIL(accessToken, orderId));

            if (response.success && response.data) {
                this.setData({ order: response.data });
            }
        } catch (error) {
            console.error('Load order failed:', error);
            wx.showToast({ title: '加载失败', icon: 'none' });
        } finally {
            this.setData({ loading: false });
        }
    },

    /**
     * 预览图片
     */
    previewImage(e: WechatMiniprogram.TouchEvent) {
        const { url } = e.currentTarget.dataset;
        const urls = this.data.order?.files.map((f) => f.url) || [];
        wx.previewImage({
            current: url,
            urls,
        });
    },

    /**
     * 评论输入
     */
    onCommentInput(e: WechatMiniprogram.Input) {
        this.setData({ comment: e.detail.value });
    },

    /**
     * 提交评论
     */
    async handleSubmitComment() {
        const { comment, order } = this.data;
        const accessToken = getAccessToken();

        if (!comment.trim() || !order || !accessToken) return;

        this.setData({ submittingComment: true });

        try {
            const response = await post(API.SALES_ORDER_COMMENT(accessToken, order.id), {
                comment: comment.trim(),
            });

            if (response.success) {
                wx.showToast({ title: '留言成功', icon: 'success' });
                this.setData({ comment: '' });
                // 刷新订单详情
                this.loadOrder(order.id);
            }
        } catch (error: any) {
            wx.showToast({ title: error.message || '留言失败', icon: 'none' });
        } finally {
            this.setData({ submittingComment: false });
        }
    },

    /**
     * 复制订单
     */
    handleDuplicate() {
        const { order } = this.data;
        if (!order) return;

        const prefill = encodeURIComponent(JSON.stringify(order.currentData));
        wx.navigateTo({ url: `/pages/form/form?prefill=${prefill}` });
    },

    /**
     * 返回
     */
    handleBack() {
        wx.navigateBack();
    },

    /**
     * 格式化时间
     */
    formatTime(timestamp: number): string {
        const date = new Date(timestamp);
        const y = date.getFullYear();
        const m = (date.getMonth() + 1).toString().padStart(2, '0');
        const d = date.getDate().toString().padStart(2, '0');
        const h = date.getHours().toString().padStart(2, '0');
        const min = date.getMinutes().toString().padStart(2, '0');
        return `${y}-${m}-${d} ${h}:${min}`;
    },

    /**
     * 获取动作类型文本
     */
    getActionText(item: OrderDetail['timeline'][0]): string {
        switch (item.actionType) {
            case 'created':
                return '创建了订单';
            case 'status_changed':
                return `状态变更: ${item.newValue}`;
            case 'field_updated':
                return `更新了 ${item.fieldName}`;
            case 'comment':
                return item.comment || '';
            default:
                return '';
        }
    },
});
