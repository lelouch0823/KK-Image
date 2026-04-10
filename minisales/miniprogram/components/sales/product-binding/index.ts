import {
  loadProductDetail,
  loadProductList,
  pickSelectableVariants,
} from '../../../services/sales/products';

type BoundValue = {
  productId?: string;
  variantId?: string;
  name?: string;
  brand?: string;
  series?: string;
  sku?: string;
  size?: string;
  color?: string;
  material?: string;
  variantLabel?: string;
  primaryImage?: string;
};

type ProductSummary = {
  id: string;
  name: string;
  brand: string;
  series: string;
  primaryImage: string;
};

type ProductVariant = {
  id: string;
  sku: string;
  displayName: string;
  optionsValues: Record<string, string>;
  primaryImage: string;
};

function buildVariantPayload(product: any, variant: ProductVariant): BoundValue {
  const options = variant.optionsValues || {};
  const values = Object.values(options).filter(Boolean).map((item) => String(item));
  return {
    productId: product.id,
    variantId: variant.id,
    name: product.name,
    brand: product.brand,
    series: product.series,
    sku: variant.sku,
    size: values.join(' / '),
    color: String(options.color || ''),
    material: String(options.material || ''),
    variantLabel: variant.displayName,
    primaryImage: variant.primaryImage || product.primaryImage,
  };
}

Component({
  properties: {
    salesToken: { type: String, value: '' },
    value: { type: Object, value: null },
  },
  data: {
    pickerVisible: false,
    loading: false,
    detailLoading: false,
    errorMessage: '',
    products: [] as ProductSummary[],
    productDetail: null as any,
    variants: [] as ProductVariant[],
    selectedProductId: '',
  },
  methods: {
    closePicker() {
      this.setData({ pickerVisible: false });
    },
    async openPicker() {
      if (!this.properties.salesToken) {
        this.setData({ errorMessage: '缺少销售令牌' });
        return;
      }

      this.setData({ pickerVisible: true });
      if (this.data.products.length > 0 || this.data.loading) {
        return;
      }

      this.setData({ loading: true, errorMessage: '' });
      try {
        const result = await loadProductList({
          accessToken: this.properties.salesToken,
          page: 1,
          limit: 12,
        });

        if (!result.success || !result.data) {
          this.setData({ errorMessage: result.error || '商品加载失败' });
          return;
        }

        this.setData({
          products: result.data.items,
          errorMessage: '',
        });
      } finally {
        this.setData({ loading: false });
      }
    },
    async retryLoad() {
      this.setData({ products: [] });
      await this.openPicker();
    },
    async selectProduct(e: WechatMiniprogram.TouchEvent) {
      const productId = String(e.currentTarget.dataset.id || '');
      if (!productId || !this.properties.salesToken) {
        return;
      }

      this.setData({
        detailLoading: true,
        selectedProductId: productId,
        errorMessage: '',
      });
      try {
        const result = await loadProductDetail({
          accessToken: this.properties.salesToken,
          productId,
        });

        if (!result.success || !result.data) {
          this.setData({ errorMessage: result.error || '商品详情加载失败' });
          return;
        }

        const selectableVariants = pickSelectableVariants(result.data, 'in_stock_only');
        if (selectableVariants.length === 0) {
          this.setData({
            productDetail: result.data,
            variants: [],
            errorMessage: '该商品暂无可下单规格',
          });
          return;
        }

        this.setData({
          productDetail: result.data,
          variants: selectableVariants,
          errorMessage: '',
        });
      } finally {
        this.setData({ detailLoading: false });
      }
    },
    selectVariant(e: WechatMiniprogram.TouchEvent) {
      const variantId = String(e.currentTarget.dataset.id || '');
      const product = this.data.productDetail;
      const variant = (this.data.variants || []).find((item) => item.id === variantId);
      if (!product || !variant) {
        return;
      }

      this.triggerEvent('change', {
        value: buildVariantPayload(product, variant),
      });
      this.closePicker();
    },
    clearValue() {
      this.triggerEvent('clear');
    },
  },
});
