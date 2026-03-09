import { customerActionAdapter } from './adapters/customer.js';
import { orderActionAdapter } from './adapters/order.js';
import { productActionAdapter } from './adapters/product.js';
import { purchaseOrderActionAdapter } from './adapters/purchase-order.js';
import { salespersonActionAdapter } from './adapters/salesperson.js';

const adapters = [
  customerActionAdapter,
  orderActionAdapter,
  productActionAdapter,
  purchaseOrderActionAdapter,
  salespersonActionAdapter,
];

const adaptersByEntity = new Map(adapters.map((adapter) => [adapter.entityType, adapter]));

export function getActionAdapter(entityType) {
  return adaptersByEntity.get(String(entityType || '').trim()) || null;
}

export function listActionAdapters() {
  return [...adapters];
}
