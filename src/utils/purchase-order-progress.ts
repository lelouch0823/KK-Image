// shared 目录在 src 外部，TS 解析路径不同，手动声明导出类型
export declare function getPurchaseOrderCancelledQty(record?: Record<string, unknown>): number;
export declare function getPurchaseOrderOrderedQty(record?: Record<string, unknown>): number;
export declare function getPurchaseOrderOutstandingQty(record?: Record<string, unknown>): number;
export declare function getPurchaseOrderReceivedQty(record?: Record<string, unknown>): number;

// 运行时 re-export
export * from '../../shared/utils/purchase-order-projection.js';
