import { get, post, getAccessToken, getFileUrl } from '../../utils/api';
import { API, STATUS_CONFIG, OrderStatus } from '../../utils/constants';
import { handleMissingAccessToken } from '../../services/auth/session';

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
        // 扩展字段用于视图渲染
        displayTitle?: string;
        displayContent?: string;
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
        // Skeleton 配置
        detailRowCol: [
            { width: '100%', height: '160rpx', borderRadius: '16rpx' },
            { width: '100%', height: '400rpx', borderRadius: '16rpx', marginTop: '24rpx' },
            { width: '100%', height: '300rpx', borderRadius: '16rpx', marginTop: '24rpx' },
        ],
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
        if (!accessToken) {
            handleMissingAccessToken();
            return;
        }

        this.setData({ loading: true });

        try {
            const response = await get<OrderDetail>(API.SALES_ORDER_DETAIL(accessToken, orderId));

            if (response.success && response.data) {
                const order = response.data;

                // 处理文件路径
                order.files = order.files.map(f => ({
                    ...f,
                    url: getFileUrl(f.url)
                }));

                // 处理时间轴文本 (逻辑下沉到逻辑层)
                order.timeline = order.timeline.map(item => ({
                    ...item,
                    displayTitle: this.getActionTitle(item),
                    displayContent: item.comment || item.fieldName || item.reason || ''
                }));

                this.setData({ order });
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

        if (!comment.trim() || !order) return;
        if (!accessToken) {
            handleMissingAccessToken();
            return;
        }

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
     * 获取动作类型标题
     */
    getActionTitle(item: any): string {
        const actionMap: Record<string, string> = {
            'created': '创建了订单',
            'status_changed': `状态变更: ${item.newValue}`,
            'field_updated': `更新了 ${item.fieldName}`,
        };
        return actionMap[item.actionType] || item.actorName || '订单动态';
    },
});
