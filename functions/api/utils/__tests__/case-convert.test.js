import { describe, it, expect } from 'vitest';
import {
  toCamelKey,
  toCamelCase,
  toCamelCaseRows,
  toSnakeKey,
  toSnakeCase,
  toSnakeCaseRows,
} from '../case-convert.js';

describe('case-convert', () => {
  describe('toCamelKey', () => {
    it('converts simple snake_case', () => {
      expect(toCamelKey('created_at')).toBe('createdAt');
    });

    it('converts multiple underscores', () => {
      expect(toCamelKey('order_line_item_id')).toBe('orderLineItemId');
    });

    it('leaves already camelCase unchanged', () => {
      expect(toCamelKey('id')).toBe('id');
      expect(toCamelKey('name')).toBe('name');
    });

    it('handles single char after underscore', () => {
      expect(toCamelKey('a_b')).toBe('aB');
    });
  });

  describe('toCamelCase', () => {
    it('converts object keys to camelCase', () => {
      expect(toCamelCase({ created_at: 123, order_no: 'ORD-001' })).toEqual({
        createdAt: 123,
        orderNo: 'ORD-001',
      });
    });

    it('preserves values unchanged', () => {
      const row = { name: 'test', tags: [1, 2], nested: { a: 1 } };
      expect(toCamelCase(row)).toEqual({
        name: 'test',
        tags: [1, 2],
        nested: { a: 1 },
      });
    });

    it('returns null/undefined as-is', () => {
      expect(toCamelCase(null)).toBeNull();
      expect(toCamelCase(undefined)).toBeUndefined();
    });

    it('handles empty object', () => {
      expect(toCamelCase({})).toEqual({});
    });
  });

  describe('toCamelCaseRows', () => {
    it('converts array of objects', () => {
      expect(
        toCamelCaseRows([
          { created_at: 1, name: 'a' },
          { created_at: 2, name: 'b' },
        ])
      ).toEqual([
        { createdAt: 1, name: 'a' },
        { createdAt: 2, name: 'b' },
      ]);
    });

    it('returns empty array unchanged', () => {
      expect(toCamelCaseRows([])).toEqual([]);
    });

    it('returns non-array as-is', () => {
      expect(toCamelCaseRows(null)).toBeNull();
    });
  });

  describe('toSnakeKey', () => {
    it('converts simple camelCase', () => {
      expect(toSnakeKey('createdAt')).toBe('created_at');
    });

    it('converts multiple capitals', () => {
      expect(toSnakeKey('orderLineItemId')).toBe('order_line_item_id');
    });

    it('leaves already snake_case unchanged', () => {
      expect(toSnakeKey('id')).toBe('id');
      expect(toSnakeKey('name')).toBe('name');
    });
  });

  describe('toSnakeCase', () => {
    it('converts object keys to snake_case', () => {
      expect(toSnakeCase({ createdAt: 123, orderNo: 'ORD-001' })).toEqual({
        created_at: 123,
        order_no: 'ORD-001',
      });
    });

    it('returns null/undefined as-is', () => {
      expect(toSnakeCase(null)).toBeNull();
      expect(toSnakeCase(undefined)).toBeUndefined();
    });
  });

  describe('toSnakeCaseRows', () => {
    it('converts array of objects', () => {
      expect(
        toSnakeCaseRows([
          { createdAt: 1, name: 'a' },
          { createdAt: 2, name: 'b' },
        ])
      ).toEqual([
        { created_at: 1, name: 'a' },
        { created_at: 2, name: 'b' },
      ]);
    });
  });

  describe('round-trip conversion', () => {
    it('camelCase -> snake_case -> camelCase preserves data', () => {
      const original = { createdAt: 123, orderNo: 'ORD-001', isDeleted: false };
      const roundTrip = toCamelCase(toSnakeCase(original));
      expect(roundTrip).toEqual(original);
    });

    it('snake_case -> camelCase -> snake_case preserves data', () => {
      const original = { created_at: 123, order_no: 'ORD-001', is_deleted: false };
      const roundTrip = toSnakeCase(toCamelCase(original));
      expect(roundTrip).toEqual(original);
    });
  });
});
