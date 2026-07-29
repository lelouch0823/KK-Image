/**
 * 前端日期时间工具
 * 统一处理中国时区 (UTC+8) 逻辑，确保在全球任意地区访问时数据筛选一致。
 */

const TZ_OFFSET: number = 8 * 60 * 60 * 1000; // UTC+8

export class DateUtils {
    /**
     * 获取当前时间戳
     */
    static get now(): number {
        return Date.now();
    }

    /**
     * 获取北京时间 "今天" 的起始时间戳 (00:00:00.000)
     * @param timestamp - 基准时间戳 (默认为当前)
     * @returns 对应北京时间 00:00:00 的 UTC 时间戳
     */
    static getBeijingDayStart(timestamp: number = Date.now()): number {
        // 1. 转为北京时间的"本地"数值
        const beijingTime = timestamp + TZ_OFFSET;
        // 2. 向下取整到天
        const beijingDayStart = Math.floor(beijingTime / 86400000) * 86400000;
        // 3. 还原回 UTC 时间戳
        return beijingDayStart - TZ_OFFSET;
    }

    /**
     * 获取北京时间 "今天" 的结束时间戳 (23:59:59.999)
     * @param timestamp - 基准时间戳
     */
    static getBeijingDayEnd(timestamp: number = Date.now()): number {
        return DateUtils.getBeijingDayStart(timestamp) + 86400000 - 1;
    }

    /**
     * 获取北京时间的 YYYY-MM-DD 日期字符串
     * @param timestamp - 时间戳（默认当前时间）
     * @returns YYYY-MM-DD
     */
    static getBeijingDateStr(timestamp: number = Date.now()): string {
        return new Date(timestamp + TZ_OFFSET).toISOString().slice(0, 10);
    }
}
