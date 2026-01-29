import { describe, it, expect, vi } from 'vitest';
import { 
  formatSize, 
  formatDuration, 
  formatDate, 
  formatExpiry, 
  getFileExtension, 
  isImage,
  formatCurrency,
  hexToRgba,
  getChartBgColor,
  formatDateWithWeekday,
  formatRelativeTime,
  formatTimelineTime,
  getChartColors
} from '../formatters';

describe('Frontend Formatters', () => {
  describe('formatSize', () => {
    it('should format bytes to human readable string', () => {
      expect(formatSize(0)).toBe('0 B');
      expect(formatSize(1024)).toBe('1 KB');
      expect(formatSize(1024 * 1024)).toBe('1 MB');
      expect(formatSize(1234567)).toBe('1.18 MB');
    });

    it('should use i18n if provided', () => {
      const t = vi.fn((key) => {
        if (key === 'formatters.units.MB') return '兆字节';
        return key;
      });
      expect(formatSize(1024 * 1024, t)).toBe('1 兆字节');
      expect(t).toHaveBeenCalled();
    });
  });

  describe('formatDuration', () => {
    const t = (key, _params) => {
      if (key === 'formatters.seconds') return '秒';
      if (key === 'formatters.minutes') return '分';
      if (key === 'formatters.hours') return '小时';
      return key;
    };

    it('should format seconds correctly', () => {
      expect(formatDuration(45, t)).toBe('45秒');
      expect(formatDuration(65, t)).toBe('1分5秒');
      expect(formatDuration(3665, t)).toBe('1小时1分');
    });

    it('should fallback if t is not provided', () => {
      expect(formatDuration(45)).toBe('45s');
    });
  });

  describe('formatDate', () => {
    it('should format timestamp to Chinese locale string by default', () => {
      const ts = 1704067200000; // 2024-01-01 00:00 UTC
      const formatted = formatDate(ts);
      expect(formatted).toMatch(/\d{4}\/\d{2}\/\d{2}/);
    });

    it('should return - for empty timestamp', () => {
      expect(formatDate(null)).toBe('-');
    });
  });

  describe('getFileExtension', () => {
    it('should return uppercase extension', () => {
      expect(getFileExtension('test.jpg')).toBe('JPG');
      expect(getFileExtension('archive.tar.gz')).toBe('GZ');
      expect(getFileExtension('noextension')).toBe('');
    });
  });

  describe('isImage', () => {
    it('should identify image files', () => {
      expect(isImage('test.jpg')).toBe(true);
      expect(isImage('test.png')).toBe(true);
      expect(isImage('test.txt')).toBe(false);
    });

    it('should handle file objects', () => {
      expect(isImage({ name: 'test.webp' })).toBe(true);
    });

    it('should handle empty or invalid input', () => {
      expect(isImage(null)).toBe(false);
      expect(isImage({})).toBe(false);
    });
  });

  describe('formatCurrency', () => {
    it('should format numbers to CNY currency', () => {
      const formatted = formatCurrency(123.45);
      expect(formatted).toContain('123.45');
    });

    it('should return - for empty input', () => {
      expect(formatCurrency('')).toBe('-');
      expect(formatCurrency(null)).toBe('-');
    });

    it('should return input as is if not a number', () => {
       expect(formatCurrency('abc')).toBe('abc');
    });
  });

  describe('Color Utils', () => {
    it('hexToRgba should convert hex with alpha', () => {
      expect(hexToRgba('#ff0000', 0.5)).toBe('rgba(255, 0, 0, 0.5)');
      expect(hexToRgba(null, 0.1)).toBe('rgba(0, 0, 0, 0.1)');
    });

    it('getChartBgColor should return rgba for chart index', () => {
      const rgba = getChartBgColor(1, 0.2);
      expect(rgba).toContain('rgba');
    });

    it('getChartColors should return array of CSS variable calls', () => {
       const colors = getChartColors(3);
       expect(colors.length).toBe(3);
    });
  });

  describe('formatDateWithWeekday', () => {
    it('should format date with weekday localized', () => {
      const t = vi.fn((key) => key.split('.').pop());
      const result = formatDateWithWeekday('2024-01-01', t);
      expect(result).toBe('2024-01-01 (1)');
    });

    it('should return - for empty date', () => {
       expect(formatDateWithWeekday(null)).toBe('-');
    });

    it('should return original if t is missing', () => {
       expect(formatDateWithWeekday('2024-01-01')).toBe('2024-01-01');
    });

    it('should return original if date is invalid', () => {
       expect(formatDateWithWeekday('invalid')).toBe('invalid');
    });
  });

  describe('formatExpiry', () => {
    it('should format expiry correctly without t', () => {
       const nowTs = Date.now();
       const result = formatExpiry(nowTs + 3600 * 1000);
       expect(result).toMatch(/\d/); // Should contain date numbers
       expect(formatExpiry(null)).toBe('-');
    });

    it('should format with t', () => {
      const t = vi.fn((key) => key);
      expect(formatExpiry(null, t)).toBe('formatters.forever');
      
      const nowTs = Date.now();
      expect(formatExpiry(nowTs - 1000, t)).toBe('formatters.expired');
      expect(formatExpiry(nowTs + 86400000 * 2, t)).toBe('formatters.daysLeft');
    });
  });

  describe('formatRelativeTime', () => {
    const t = (key) => key;
    it('should return justNow for very recent', () => {
       expect(formatRelativeTime(Date.now() - 1000, t)).toBe('common.justNow');
    });

    it('should return units ago', () => {
       expect(formatRelativeTime(Date.now() - 120000, t)).toBe('common.minutesAgo');
       expect(formatRelativeTime(Date.now() - 7200000, t)).toBe('common.hoursAgo');
    });

    it('should return date if more than a day', () => {
       expect(formatRelativeTime(Date.now() - 90000000, t)).toMatch(/\d\/\d/);
    });

    it('should return empty/unknown if t or ts missing', () => {
       expect(formatRelativeTime(null)).toBe('');
       expect(formatRelativeTime(null, t)).toBe('common.unknown');
       expect(formatRelativeTime(Date.now(), null)).toBe('');
    });
  });

  describe('formatTimelineTime', () => {
    it('should format time correctly', () => {
       const now = Date.now();
       expect(formatTimelineTime(now)).toMatch(/\d{1,2}:\d{2}/);
       expect(formatTimelineTime(now - 86400000 * 2)).toMatch(/\d\/\d/);
       expect(formatTimelineTime(null)).toBe('');
    });
  });
});
