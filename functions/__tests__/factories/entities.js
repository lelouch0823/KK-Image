/**
 * 统一的测试数据工厂
 *
 * 为各实体提供合理的默认值，支持通过 overrides 覆盖任意字段。
 * 所有 ID 默认使用递增计数器，时间戳默认为固定值以便测试断言。
 *
 * @example
 * import { createOrder, createFile, createCustomer } from '../factories/entities.js';
 *
 * const order = createOrder();                                    // 默认订单
 * const custom = createOrder({ status: 'confirmed', id: 'my-id' }); // 覆盖字段
 * const files = [createFile(), createFile({ name: 'test.jpg' })];
 */
let counter = 0;

/** 重置 ID 计数器（在 beforeEach 中调用以确保测试隔离） */
export function resetCounter() {
  counter = 0;
}

/** 生成唯一 ID */
function nextId(prefix = 'test') {
  return `${prefix}-${++counter}`;
}

// =============================================================================
// 订单 (orders)
// =============================================================================

/**
 * 创建订单测试数据
 *
 * @param {object} [overrides] - 覆盖默认值
 * @returns {object} 完整的订单对象
 */
export function createOrder(overrides = {}) {
  const id = overrides.id ?? nextId('order');
  return {
    id,
    order_no: `ORD-20260101-${String(counter).padStart(4, '0')}`,
    salesperson_id: 'salesperson-1',
    customer_id: null,
    variant_id: null,
    original_data: JSON.stringify({ name: '测试客户', size: 'M', color: '红色', material: '棉', remark: '' }),
    current_data: JSON.stringify({ name: '测试客户', size: 'M', color: '红色', material: '棉', remark: '' }),
    status: 'pending',
    main_image_id: null,
    has_new_feedback: 0,
    created_at: 1735689600000, // 2026-01-01 00:00:00 UTC
    updated_at: 1735689600000,
    ...overrides,
  };
}

// =============================================================================
// 文件 (files)
// =============================================================================

/**
 * 创建文件测试数据
 *
 * @param {object} [overrides] - 覆盖默认值
 * @returns {object} 完整的文件对象
 */
export function createFile(overrides = {}) {
  const id = overrides.id ?? nextId('file');
  return {
    id,
    folder_id: 'root',
    name: `image-${counter}.jpg`,
    original_name: `原始图片-${counter}.jpg`,
    size: 102400,
    mime_type: 'image/jpeg',
    storage_key: `files/${id}/image.jpg`,
    created_at: 1735689600000,
    ...overrides,
  };
}

// =============================================================================
// 文件夹 (folders)
// =============================================================================

/**
 * 创建文件夹测试数据
 *
 * @param {object} [overrides] - 覆盖默认值
 * @returns {object} 完整的文件夹对象
 */
export function createFolder(overrides = {}) {
  const id = overrides.id ?? nextId('folder');
  return {
    id,
    parent_id: null,
    name: `测试文件夹-${counter}`,
    description: '',
    share_token: null,
    is_public: 0,
    password: null,
    created_at: 1735689600000,
    updated_at: 1735689600000,
    ...overrides,
  };
}

// =============================================================================
// 客户 (customers)
// =============================================================================

/**
 * 创建客户测试数据
 *
 * @param {object} [overrides] - 覆盖默认值
 * @returns {object} 完整的客户对象
 */
export function createCustomer(overrides = {}) {
  const id = overrides.id ?? nextId('customer');
  return {
    id,
    name: `测试客户-${counter}`,
    company: `测试公司-${counter}`,
    phone: `1380000${String(counter).padStart(4, '0')}`,
    email: `customer${counter}@test.com`,
    address: '测试地址',
    tags: '[]',
    remark: '',
    created_by: 'salesperson-1',
    created_at: 1735689600000,
    updated_at: 1735689600000,
    ...overrides,
  };
}

// =============================================================================
// 产品 (products)
// =============================================================================

/**
 * 创建产品测试数据
 *
 * @param {object} [overrides] - 覆盖默认值
 * @returns {object} 完整的产品对象
 */
export function createProduct(overrides = {}) {
  const id = overrides.id ?? nextId('product');
  return {
    id,
    name: `测试产品-${counter}`,
    spu: `SPU-${String(counter).padStart(4, '0')}`,
    slug: `test-product-${counter}`,
    category: '默认分类',
    brand: '',
    series: '',
    price: 99.9,
    cost_price: 50.0,
    stock_quantity: 100,
    alert_threshold: 10,
    description: '测试产品描述',
    images: '[]',
    specifications: '{}',
    options: '[]',
    status: 'active',
    created_at: 1735689600000,
    updated_at: 1735689600000,
    ...overrides,
  };
}

// =============================================================================
// 产品变体 (product_variants)
// =============================================================================

/**
 * 创建产品变体测试数据
 *
 * @param {object} [overrides] - 覆盖默认值
 * @returns {object} 完整的产品变体对象
 */
export function createVariant(overrides = {}) {
  const id = overrides.id ?? nextId('variant');
  return {
    id,
    product_id: 'product-1',
    sku: `SKU-${String(counter).padStart(4, '0')}`,
    price: 99.9,
    cost_price: 50.0,
    stock_quantity: 100,
    options_values: '{}',
    image_id: null,
    status: 'active',
    created_at: 1735689600000,
    updated_at: 1735689600000,
    ...overrides,
  };
}

// =============================================================================
// 销售人员 (salespersons)
// =============================================================================

/**
 * 创建销售人员测试数据
 *
 * @param {object} [overrides] - 覆盖默认值
 * @returns {object} 完整的销售人员对象
 */
export function createSalesperson(overrides = {}) {
  const id = overrides.id ?? nextId('salesperson');
  return {
    id,
    name: `测试销售-${counter}`,
    store: `门店-${counter}`,
    phone: `1390000${String(counter).padStart(4, '0')}`,
    access_token: `token-${id}`,
    password_hash: '$2b$10$abcdefghijklmnopqrstuuABCDEFGHIJKLMNOPQRSTUVWXYZ',
    is_active: 1,
    created_at: 1735689600000,
    updated_at: 1735689600000,
    ...overrides,
  };
}
