import { describe, it, expect } from 'vitest';
import { DateUtils } from '../date';

describe('DateUtils', () => {
  describe('now', () => {
    it('应返回数字类型的时间戳', () => {
      const result = DateUtils.now;
      expect(typeof result).toBe('number');
    });

    it('应返回接近当前时间的时间戳', () => {
      const before = Date.now();
      const result = DateUtils.now;
      const after = Date.now();
      expect(result).toBeGreaterThanOrEqual(before);
      expect(result).toBeLessThanOrEqual(after);
    });
  });

  describe('getBeijingDayStart', () => {
    it('应返回数字类型', () => {
      const result = DateUtils.getBeijingDayStart();
      expect(typeof result).toBe('number');
    });

    it('返回值应小于等于传入的时间戳', () => {
      const now = Date.now();
      const start = DateUtils.getBeijingDayStart(now);
      expect(start).toBeLessThanOrEqual(now);
    });

    it('返回值与传入时间戳的差应小于 24 小时', () => {
      const now = Date.now();
      const start = DateUtils.getBeijingDayStart(now);
      const diff = now - start;
      expect(diff).toBeLessThan(86400000);
      expect(diff).toBeGreaterThanOrEqual(0);
    });

    it('对同一北京时间天内的不同时间戳应返回相同结果', () => {
      // 2024-06-15 10:00:00 UTC+8 = 2024-06-15 02:00:00 UTC
      // 使用一个固定时间戳来验证一致性
      const ts1 = new Date('2024-06-15T02:00:00Z').getTime();
      const ts2 = new Date('2024-06-15T09:59:59Z').getTime();
      expect(DateUtils.getBeijingDayStart(ts1)).toBe(DateUtils.getBeijingDayStart(ts2));
    });

    it('默认参数时应使用当前时间', () => {
      const before = Date.now();
      const result = DateUtils.getBeijingDayStart();
      const after = Date.now();
      // 默认调用的 getBeijingDayStart 对应当天起始，应 <= now
      expect(result).toBeLessThanOrEqual(after);
      // 且差值应小于 24 小时
      expect(before - result).toBeLessThan(86400000);
    });
  });

  describe('getBeijingDayEnd', () => {
    it('应返回数字类型', () => {
      const result = DateUtils.getBeijingDayEnd();
      expect(typeof result).toBe('number');
    });

    it('返回值应大于 getBeijingDayStart 的返回值', () => {
      const now = Date.now();
      const start = DateUtils.getBeijingDayStart(now);
      const end = DateUtils.getBeijingDayEnd(now);
      expect(end).toBeGreaterThan(start);
    });

    it('end 与 start 的差应为 86399999 毫秒 (24h - 1ms)', () => {
      const now = Date.now();
      const start = DateUtils.getBeijingDayStart(now);
      const end = DateUtils.getBeijingDayEnd(now);
      expect(end - start).toBe(86400000 - 1);
    });

    it('对同一北京时间天内的时间戳应返回相同的 dayEnd', () => {
      const ts1 = new Date('2024-06-15T02:00:00Z').getTime();
      const ts2 = new Date('2024-06-15T09:00:00Z').getTime();
      expect(DateUtils.getBeijingDayEnd(ts1)).toBe(DateUtils.getBeijingDayEnd(ts2));
    });
  });
});
