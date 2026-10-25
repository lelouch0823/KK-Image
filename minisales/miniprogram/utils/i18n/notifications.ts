/**
 * 小程序通知文案词典（C-R4 / 审查 C-F6）
 *
 * 后端 notification-consumer 产出的 title/content 是 i18n 描述符
 * （`{"key":...,"params":{...}}` JSON 或裸 key），Web 端经
 * src/utils/notification-text.ts + locales 翻译；小程序此前原样透传，
 * 通知抽屉显示 JSON 原文。本词典覆盖 consumer 产出的全部 key（文案与
 * Web 端 zh-CN locales 对齐， locales 缺失的 key 按 locales 语义补齐），
 * 支持 {param} 占位替换。
 */

const NOTIFICATION_TEXT: Record<string, string> = {
    // notification.*（misc.js）
    'notification.newFeedback': '您有新的订单反馈',
    'notification.newOrder': '收到新订单',
    'notification.purchase_receipt_recorded': '采购收货已登记',
    'notification.purchase_receipt_recorded_desc': '采购单 {purchaseOrderId} 新登记到货 {qty} 件。',
    'notification.order_procurement_progressed': '预定单采购进度已推进',
    'notification.order_procurement_progressed_desc':
        '采购单 {purchaseOrderId} 本次到货 {qty} 件，采购状态更新为 {status}。',
    'notification.purchase_receipt_reversed': '采购收货已冲销',
    'notification.purchase_receipt_reversed_desc': '采购单 {purchaseOrderId} 已冲销收货 {qty} 件。',
    'notification.order_procurement_reversed': '预定单采购进度已回退',
    'notification.order_procurement_reversed_desc':
        '采购单 {purchaseOrderId} 已回退 {qty} 件到货，采购状态更新为 {status}。',
    'notification.reminder.pending_order_title': '待处理订单提醒',
    'notification.reminder.pending_order_desc': '订单 {orderNo} 已超过 24 小时未处理，请及时审核。',
    'notification.reminder.deadline_title': '交货期临近提醒',
    'notification.reminder.deadline_desc': '订单 {orderNo} 期望交货日期为 {deadline}，请关注进度。',
    'notification.order.created': '收到新订单',
    'notification.order.createdDesc': '{salesperson} 提交了订单 {orderNo}',
    'notification.order.updated': '订单已修改',
    'notification.order.updatedDesc': '{actor} 修改了订单 {orderNo}',
    'notification.order.commented': '收到新留言',
    'notification.order.commentedDesc': '{actor} 在订单 {orderNo} 中留言',
    'notification.order.statusChanged': '订单状态更新',
    'notification.order.statusChangedDesc': '订单 {orderNo} 状态已变更为 {status}',
    'notification.order.batchStatusChanged': '批量订单状态更新',
    'notification.order.batchStatusChangedDesc': '{count} 个订单已{action}',
    // consumer 产出但 locales 未收录的 key（与 Web 端行为一致地补中文）
    'notification.orderAssigned': '您有新的指派订单',
    'notification.order.deliveryConfirmed': '订单已确认交付',
    'notification.order.returnCreated': '订单退货已创建',
    'notification.order.returnRestocked': '订单退货已重新入库',
};

function interpolate(template: string, params: Record<string, unknown> | undefined): string {
    if (!params) return template;
    return template.replace(/\{(\w+)\}/g, (match, name: string) => {
        const value = params[name];
        return value === undefined || value === null ? match : String(value);
    });
}

/**
 * 渲染通知文本：JSON 描述符（{"key":...,"params":{...}}）→ 词典翻译 + 占位
 * 替换；裸 key → 词典翻译；未收录或解析失败 → 原样透传（不吞内容）。
 */
export function renderNotificationText(value: unknown): string {
    if (!value) return '';
    const str = String(value);
    if (str.startsWith('{')) {
        try {
            const parsed = JSON.parse(str) as { key?: unknown; params?: Record<string, unknown> };
            if (parsed && typeof parsed.key === 'string') {
                const template = NOTIFICATION_TEXT[parsed.key];
                return template ? interpolate(template, parsed.params) : str;
            }
        } catch {
            return str;
        }
        return str;
    }
    const template = NOTIFICATION_TEXT[str];
    return template || str;
}
