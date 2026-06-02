import type { NormalizedSalesProductSummary } from '../../utils/normalize/product';

export interface ScanResult {
  scanCode: string;
  product: NormalizedSalesProductSummary | null;
  matched: boolean;
}

export interface StockAdjustment {
  productId: string;
  variantId: string;
  quantity: number;
  direction: 'in' | 'out';
  remark: string;
}

export function buildScanResultViewModel(result: ScanResult) {
  if (!result.matched || !result.product) {
    return {
      matched: false,
      scanCode: result.scanCode,
      title: '未匹配商品',
      subtitle: `条码: ${result.scanCode}`,
      image: '',
      details: [],
    };
  }

  const product = result.product;
  return {
    matched: true,
    scanCode: result.scanCode,
    title: product.name || '未命名商品',
    subtitle: [product.brand, product.series].filter(Boolean).join(' / ') || product.spu || '',
    image: product.primaryImage || '',
    details: [
      { label: 'SPU', value: product.spu || '-' },
      { label: '品牌', value: product.brand || '-' },
      { label: '系列', value: product.series || '-' },
    ],
  };
}
