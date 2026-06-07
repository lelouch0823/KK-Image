/**
 * ERP 适配器抽象层
 * 提供统一接口对接不同 ERP 系统（金蝶、用友、SAP 等）
 *
 * @module services/ErpAdapter
 */

/**
 * ERP 适配器基类
 * 所有具体适配器必须继承此类并实现抽象方法
 */
export class BaseErpAdapter {
  constructor(connection) {
    this.connection = connection;
    this.baseUrl = connection.baseUrl;
    this.credentials = connection.credentials || {};
    this.config = connection.config || {};
  }

  /** 获取适配器名称 */
  get name() {
    return this.constructor.name;
  }

  /**
   * 测试连接
   * @returns {Promise<{success: boolean, message: string}>}
   */
  async testConnection() {
    throw new Error('testConnection() not implemented');
  }

  /**
   * 推送商品到 ERP
   * @param {Object} product - 本地商品数据
   * @returns {Promise<{erpId: string, erpCode?: string, data: Object}>}
   */
  async pushProduct(product) {
    throw new Error('pushProduct() not implemented');
  }

  /**
   * 从 ERP 拉取商品
   * @param {string} erpId - ERP 商品 ID
   * @returns {Promise<Object>}
   */
  async pullProduct(erpId) {
    throw new Error('pullProduct() not implemented');
  }

  /**
   * 推送客户到 ERP
   * @param {Object} customer - 本地客户数据
   * @returns {Promise<{erpId: string, erpCode?: string, data: Object}>}
   */
  async pushCustomer(customer) {
    throw new Error('pushCustomer() not implemented');
  }

  /**
   * 从 ERP 拉取客户
   * @param {string} erpId - ERP 客户 ID
   * @returns {Promise<Object>}
   */
  async pullCustomer(erpId) {
    throw new Error('pullCustomer() not implemented');
  }

  /**
   * 推送订单到 ERP
   * @param {Object} order - 本地订单数据
   * @returns {Promise<{erpId: string, erpCode?: string, data: Object}>}
   */
  async pushOrder(order) {
    throw new Error('pushOrder() not implemented');
  }

  /**
   * 从 ERP 拉取订单
   * @param {string} erpId - ERP 订单 ID
   * @returns {Promise<Object>}
   */
  async pullOrder(erpId) {
    throw new Error('pullOrder() not implemented');
  }

  /**
   * 批量拉取 ERP 数据（增量同步）
   * @param {string} entityType - 实体类型
   * @param {Object} opts - { since, limit, page }
   * @returns {Promise<{items: Object[], hasMore: boolean}>}
   */
  async listRemote(entityType, opts = {}) {
    throw new Error('listRemote() not implemented');
  }
}

/**
 * 通用 REST 适配器
 * 适用于标准 RESTful API 的 ERP 系统
 */
export class GenericRestAdapter extends BaseErpAdapter {
  async _request(method, path, body = null) {
    const url = `${this.baseUrl.replace(/\/+$/, '')}${path}`;
    const headers = {
      'Content-Type': 'application/json',
      ...this._buildAuthHeaders(),
    };
    const opts = { method, headers };
    if (body) opts.body = JSON.stringify(body);

    const resp = await fetch(url, opts);
    if (!resp.ok) {
      const text = await resp.text().catch(() => '');
      throw new Error(`ERP API error ${resp.status}: ${text}`);
    }
    return resp.json();
  }

  _buildAuthHeaders() {
    const { authType, credentials } = this.connection;
    if (authType === 'api_key') {
      return { Authorization: `Bearer ${credentials.apiKey || credentials.api_key || ''}` };
    }
    if (authType === 'basic') {
      const encoded = btoa(`${credentials.username || ''}:${credentials.password || ''}`);
      return { Authorization: `Basic ${encoded}` };
    }
    return {};
  }

  _entityEndpoints(entityType) {
    const map = {
      product: {
        list: '/api/products',
        get: '/api/products',
        create: '/api/products',
        update: '/api/products',
      },
      customer: {
        list: '/api/customers',
        get: '/api/customers',
        create: '/api/customers',
        update: '/api/customers',
      },
      order: {
        list: '/api/orders',
        get: '/api/orders',
        create: '/api/orders',
        update: '/api/orders',
      },
    };
    return map[entityType] || map.product;
  }

  async testConnection() {
    try {
      const endpoints = this._entityEndpoints('product');
      await this._request('GET', `${endpoints.list}?limit=1`);
      return { success: true, message: '连接成功' };
    } catch (err) {
      return { success: false, message: err.message };
    }
  }

  async pushProduct(product) {
    const endpoints = this._entityEndpoints('product');
    const payload = this._mapProductToErp(product);
    const data = await this._request('POST', endpoints.create, payload);
    return { erpId: String(data.id || data.erp_id), erpCode: data.code || data.erp_code, data };
  }

  async pullProduct(erpId) {
    const endpoints = this._entityEndpoints('product');
    return this._request('GET', `${endpoints.get}/${erpId}`);
  }

  async pushCustomer(customer) {
    const endpoints = this._entityEndpoints('customer');
    const payload = this._mapCustomerToErp(customer);
    const data = await this._request('POST', endpoints.create, payload);
    return { erpId: String(data.id || data.erp_id), erpCode: data.code || data.erp_code, data };
  }

  async pullCustomer(erpId) {
    const endpoints = this._entityEndpoints('customer');
    return this._request('GET', `${endpoints.get}/${erpId}`);
  }

  async pushOrder(order) {
    const endpoints = this._entityEndpoints('order');
    const payload = this._mapOrderToErp(order);
    const data = await this._request('POST', endpoints.create, payload);
    return { erpId: String(data.id || data.erp_id), erpCode: data.code || data.erp_code, data };
  }

  async pullOrder(erpId) {
    const endpoints = this._entityEndpoints('order');
    return this._request('GET', `${endpoints.get}/${erpId}`);
  }

  async listRemote(entityType, { since, limit = 50, page = 1 } = {}) {
    const endpoints = this._entityEndpoints(entityType);
    let query = `?limit=${limit}&page=${page}`;
    if (since) query += `&updated_after=${encodeURIComponent(since)}`;
    const data = await this._request('GET', `${endpoints.list}${query}`);
    const items = Array.isArray(data) ? data : data.items || data.data || [];
    return { items, hasMore: items.length >= limit };
  }

  _mapProductToErp(product) {
    return {
      name: product.name,
      code: product.id,
      price: product.price,
      category: product.category,
      status: product.status,
      description: product.description,
    };
  }

  _mapCustomerToErp(customer) {
    return {
      name: customer.name,
      code: customer.id,
      phone: customer.phone,
      email: customer.email,
      address: customer.address,
    };
  }

  _mapOrderToErp(order) {
    return {
      order_no: order.orderNo || order.id,
      customer_code: order.customerId,
      total_amount: order.totalAmount,
      status: order.status,
      items: order.items || [],
    };
  }
}

/**
 * 适配器工厂
 * 根据连接配置创建对应的适配器实例
 */
export class ErpAdapterFactory {
  static ADAPTERS = {
    generic: GenericRestAdapter,
    rest: GenericRestAdapter,
  };

  /**
   * 注册自定义适配器
   */
  static register(type, AdapterClass) {
    ErpAdapterFactory.ADAPTERS[type] = AdapterClass;
  }

  /**
   * 创建适配器实例
   * @param {Object} connection - erp_connections 行数据
   * @returns {BaseErpAdapter}
   */
  static create(connection) {
    const AdapterClass = ErpAdapterFactory.ADAPTERS[connection.adapterType] || GenericRestAdapter;
    return new AdapterClass(connection);
  }
}
