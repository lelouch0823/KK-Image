import { describe, expect, it } from 'vitest';
import { extractActionSlots } from '../slot-extraction.js';

describe('extractActionSlots', () => {
  it('extracts customer fields from natural language', () => {
    const result = extractActionSlots(
      'customer',
      '新增客户 Alice，电话 13800000000，邮箱 alice@example.com，公司 星河贸易'
    );

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
    const result = extractActionSlots(
      'salesperson',
      '创建业务员 张三，门店 深圳万象城，手机 13911112222，密码 abc123'
    );

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
    const result = extractActionSlots(
      'order',
      '帮我创建订单，商品名 Classic Runner，给张三下 2 件'
    );

    expect(result).toEqual(
      expect.objectContaining({
        productName: 'Classic Runner',
        salespersonId: '张三',
        quantity: 2,
      })
    );
  });

  it('extracts order color and size hints from natural language', () => {
    const result = extractActionSlots('order', '帮我创建订单，商品名 跑鞋，黑色，42码，给张三 2件');

    expect(result).toEqual(
      expect.objectContaining({
        productName: '跑鞋',
        color: '黑色',
        size: '42',
        quantity: 2,
      })
    );
  });

  it('extracts purchase-order from-orders mode and order ids', () => {
    const result = extractActionSlots(
      'purchase_order',
      '从订单 ord-1, ord-2 创建采购单，备注 补货'
    );

    expect(result).toEqual(
      expect.objectContaining({
        mode: 'from_orders',
        order_ids: ['ord-1', 'ord-2'],
        remark: '补货',
      })
    );
  });

  it('extracts manual purchase-order item draft from natural language', () => {
    const result = extractActionSlots(
      'purchase_order',
      '创建采购单，跑鞋 黑色 42 补货 20件，单价 60，备注 急单'
    );

    expect(result).toEqual(
      expect.objectContaining({
        mode: 'manual',
        items: [
          expect.objectContaining({
            variant_query: '跑鞋 黑色 42',
            quantity: 20,
            unit_cost: 60,
          }),
        ],
        remark: '急单',
      })
    );
  });

  it('extracts multiple manual purchase-order items separated by semicolons', () => {
    const result = extractActionSlots(
      'purchase_order',
      '创建采购单，跑鞋 黑色 42 补货 20件 单价60；凉鞋 白色 38 补货 10件 单价50，备注 急单'
    );

    expect(result.mode).toBe('manual');
    expect(result.items).toHaveLength(2);
    expect(result.items[0]).toEqual(
      expect.objectContaining({
        variant_query: '跑鞋 黑色 42',
        quantity: 20,
        unit_cost: 60,
      })
    );
    expect(result.items[1]).toEqual(
      expect.objectContaining({
        variant_query: '凉鞋 白色 38',
        quantity: 10,
        unit_cost: 50,
      })
    );
  });

  it('infers manual purchase-order follow-up item text without repeating 采购单', () => {
    const result = extractActionSlots('purchase_order', '跑鞋 黑色 42 补货 20件 单价60');

    expect(result).toEqual(
      expect.objectContaining({
        mode: 'manual',
        items: [
          expect.objectContaining({
            variant_query: '跑鞋 黑色 42',
            quantity: 20,
            unit_cost: 60,
          }),
        ],
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

  it('extracts freer product specification language with color counts and numeric size ranges', () => {
    const result = extractActionSlots(
      'product',
      '创建商品 跑鞋，黑白两个颜色，40到42码，每个库存10，售价100，成本60，预警2'
    );

    expect(result).toEqual(
      expect.objectContaining({
        name: '跑鞋',
        dimensions: expect.any(Array),
        variants: expect.any(Array),
      })
    );
    expect(result.dimensions).toEqual([
      expect.objectContaining({ name: '颜色', values: ['黑色', '白色'] }),
      expect.objectContaining({ name: '尺码', values: ['40', '41', '42'] }),
    ]);
    expect(result.variants).toHaveLength(6);
    expect(result.variants[0]).toEqual(
      expect.objectContaining({
        stock_quantity: 10,
        price: 100,
        cost_price: 60,
        alert_threshold: 2,
      })
    );
  });

  it('extracts freer product specification language with slash-separated sizes', () => {
    const result = extractActionSlots(
      'product',
      '新建商品 凉鞋，颜色黑色 白色，尺码 36/37/38，库存 5，售价 80，成本 40'
    );

    expect(result.dimensions).toEqual([
      expect.objectContaining({ name: '颜色', values: ['黑色', '白色'] }),
      expect.objectContaining({ name: '尺码', values: ['36', '37', '38'] }),
    ]);
    expect(result.variants).toHaveLength(6);
  });
});
