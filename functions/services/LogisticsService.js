/**
 * 物流查询服务 (Logistics Tracking Service)
 * ===========================================
 *
 * 提供物流轨迹查询功能。当前使用模拟数据，后续可对接真实快递 API（如快递100、菜鸟等）。
 *
 * @module services/LogisticsService
 */

/**
 * 模拟物流轨迹数据生成器
 * 根据运单号生成确定性的模拟轨迹
 */
function generateMockTrackingEvents(trackingNo, carrier = 'express') {
  if (!trackingNo) return [];

  // 使用运单号生成确定性的时间戳偏移
  const seed = trackingNo.split('').reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
  const now = Date.now();

  const carriers = {
    express: { name: '标准快递', code: 'EXP' },
    ems: { name: 'EMS', code: 'EMS' },
    sf: { name: '顺丰速运', code: 'SF' },
    jd: { name: '京东物流', code: 'JD' },
    yto: { name: '圆通速递', code: 'YTO' },
    zto: { name: '中通快递', code: 'ZTO' },
    sto: { name: '韵达快递', code: 'STO' },
  };

  const carrierInfo = carriers[carrier] || carriers.express;

  const templates = [
    {
      status: 'collected',
      statusText: '已揽收',
      description: `快件已由 ${carrierInfo.name} 揽收`,
      location: '发件城市集散中心',
      hoursOffset: -72,
    },
    {
      status: 'in_transit',
      statusText: '运输中',
      description: '快件已到达中转中心',
      location: '中转站',
      hoursOffset: -48,
    },
    {
      status: 'in_transit',
      statusText: '运输中',
      description: '快件正在运输途中',
      location: '高速运输',
      hoursOffset: -24,
    },
    {
      status: 'arriving',
      statusText: '派送中',
      description: '快件已到达目的城市，正在派送',
      location: '收件城市集散中心',
      hoursOffset: -6,
    },
    {
      status: 'delivered',
      statusText: '已签收',
      description: '快件已签收，签收人：本人签收',
      location: '收件地址',
      hoursOffset: -2,
    },
  ];

  const eventCount = 3 + (seed % 3); // 3-5 个事件
  const events = templates.slice(0, eventCount);

  return events.map((event, index) => ({
    id: `mock_${trackingNo}_${index}`,
    status: event.status,
    statusText: event.statusText,
    description: event.description,
    location: event.location,
    timestamp: new Date(now + event.hoursOffset * 3600_000).toISOString(),
    operator: carrierInfo.name,
  }));
}

export class LogisticsService {
  constructor(db, deps = {}) {
    this.db = db;
    this.carrier = deps.carrier || 'express';
  }

  /**
   * 查询物流轨迹（当前使用模拟数据）
   * @param {string} trackingNo - 运单号
   * @param {string} carrier - 快递公司代码
   * @returns {Promise<{success: boolean, trackingNo: string, carrier: string, events: Array, status: string}>}
   */
  async queryTracking(trackingNo, carrier) {
    if (!trackingNo) {
      return {
        success: false,
        trackingNo: '',
        carrier: '',
        events: [],
        status: 'unknown',
      };
    }

    const effectiveCarrier = carrier || this.carrier;
    const events = generateMockTrackingEvents(trackingNo, effectiveCarrier);

    // 根据最后一个事件确定当前状态
    const lastEvent = events[events.length - 1];
    const currentStatus = lastEvent?.status || 'unknown';

    return {
      success: true,
      trackingNo,
      carrier: effectiveCarrier,
      events,
      status: currentStatus,
    };
  }

  /**
   * 获取支持的快递公司列表
   * @returns {Array<{code: string, name: string}>}
   */
  getSupportedCarriers() {
    return [
      { code: 'express', name: '标准快递' },
      { code: 'ems', name: 'EMS' },
      { code: 'sf', name: '顺丰速运' },
      { code: 'jd', name: '京东物流' },
      { code: 'yto', name: '圆通速递' },
      { code: 'zto', name: '中通快递' },
      { code: 'sto', name: '韵达快递' },
    ];
  }
}
