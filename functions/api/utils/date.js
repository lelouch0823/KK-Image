/**
 * 日期时间工具
 * SOTA Timezone handling (Default: UTC+8)
 */

const TZ_OFFSET = 8 * 60 * 60 * 1000; // UTC+8

export class DateUtils {
    /**
     * 获取带时区偏移的当前时间戳
     * @returns {number}
     */
    static get now() {
        return Date.now();
    }

    /**
     * 获取中国时区当前时间的日期对象
     * @param {number} timestamp - 可选时间戳
     * @returns {Date}
     */
    static getChinaDate(timestamp = Date.now()) {
        return new Date(timestamp + TZ_OFFSET);
    }

    /**
     * 获取中国时区"今天"的起始时间戳 (UTC)
     * @param {number} timestamp - 基准时间戳
     * @returns {number} UTC Timestamp matching 00:00:00 in China
     */
    static getChinaDayStart(timestamp = Date.now()) {
        const localTime = timestamp + TZ_OFFSET;
        const localTodayStart = Math.floor(localTime / 86400000) * 86400000;
        return localTodayStart - TZ_OFFSET;
    }

    /**
     * 获取中国时区的 YYYY-MM-DD 日期字符串
     * @param {number} timestamp - 时间戳
     * @returns {string} YYYY-MM-DD
     */
    static getChinaDateStr(timestamp = Date.now()) {
        return new Date(timestamp + TZ_OFFSET).toISOString().slice(0, 10);
    }

    /**
     * 解析中国时区的 YYYY-MM-DD 为 UTC 时间戳 (该日期的 00:00:00)
     * @param {string} dateStr - YYYY-MM-DD
     * @returns {number} UTC Timestamp
     */
    static parseChinaDate(dateStr) {
        if (!dateStr) return null;
        const [y, m, d] = dateStr.split('-').map(Number);
        // Construct UTC date then subtract offset
        const utcDate = Date.UTC(y, m - 1, d);
        return utcDate - TZ_OFFSET;
    }
}

// Backwards compatibility exports
export const getNow = () => DateUtils.now;
export const getChinaDate = DateUtils.getChinaDate;
export const getChinaDayStart = DateUtils.getChinaDayStart;
export const getChinaDateStr = DateUtils.getChinaDateStr;
export const parseChinaDate = DateUtils.parseChinaDate;
