import { describe, expect, it } from 'vitest';
import { extractActionSlots } from '../slot-extraction.js';

describe('extractActionSlots', () => {
  it('extracts customer fields from natural language', () => {
    const result = extractActionSlots('customer', '新增客户 Alice，电话 13800000000，邮箱 alice@example.com，公司 星河贸易');

    expect(result).toEqual(
      expect.objectContaining({
        name: 'Alice',
        phone: '13800000000',
        email: 'alice@example.com',
        company: '星河贸易',
      })
    );
  });

  it('extracts salesperson fields including password and store', () => {
    const result = extractActionSlots('salesperson', '创建业务员 张三，门店 深圳万象城，手机 13911112222，密码 abc123');

    expect(result).toEqual(
      expect.objectContaining({
        name: '张三',
        store: '深圳万象城',
        phone: '13911112222',
        password: 'abc123',
      })
    );
  });

  it('extracts order quantity and salesperson raw identifier', () => {
    const result = extractActionSlots('order', '帮我创建订单，商品名 Classic Runner，给张三下 2 件');

    expect(result).toEqual(
      expect.objectContaining({
        productName: 'Classic Runner',
        salespersonId: '张三',
        quantity: 2,
      })
    );
  });

  it('extracts purchase-order from-orders mode and order ids', () => {
    const result = extractActionSlots('purchase_order', '从订单 ord-1, ord-2 创建采购单，备注 补货');

    expect(result).toEqual(
      expect.objectContaining({
        mode: 'from_orders',
        order_ids: ['ord-1', 'ord-2'],
        remark: '补货',
      })
    );
  });

  it('extracts product fields, dimensions, and generated variants from structured text', () => {
    const result = extractActionSlots(
      'product',
      '创建商品 名称 跑鞋 SPU SPU-001 币种 CNY 规格: 颜色=黑|白; 尺码=40|41 售价=100 成本=60 库存=10 预警=2'
    );

    expect(result).toEqual(
      expect.objectContaining({
        name: '跑鞋',
        spu: 'SPU-001',
        currency: 'CNY',
        dimensions: expect.any(Array),
        variants: expect.any(Array),
      })
    );
    expect(result.dimensions).toHaveLength(2);
    expect(result.variants).toHaveLength(4);
    expect(result.variants[0]).toEqual(
      expect.objectContaining({
        price: 100,
        cost_price: 60,
        stock_quantity: 10,
        alert_threshold: 2,
        status: 'active',
      })
    );
  });
});
