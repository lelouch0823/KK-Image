import { computed } from 'vue';
import { useResource, type ApiResponse } from './useResource';
import { API } from '@/utils/constants';

// ============================================================
// 类型定义
// ============================================================

/** 产品维度值 */
interface DimensionValue {
  id: string;
  value: string;
  status?: string;
  [key: string]: unknown;
}

/** 产品维度 */
interface Dimension {
  id: string;
  name: string;
  status?: string;
  values?: DimensionValue[];
  [key: string]: unknown;
}

/** 产品变体 */
interface ProductVariant {
  id: string;
  sku: string;
  price?: number;
  costPrice?: number;
  stockQuantity?: number;
  status?: string;
  optionsValues?: string;
  imageId?: string;
  [key: string]: unknown;
}

/** 产品列表项 */
interface ProductListItem {
  id: string;
  name: string;
  spu?: string;
  brand?: string;
  series?: string;
  status?: string;
  price?: number;
  costPrice?: number;
  stockQuantity?: number;
  availableQuantity?: number;
  specifications?: unknown;
  images?: unknown;
  dimensions?: Dimension[];
  [key: string]: unknown;
}

/** 产品详情（含变体和维度） */
interface ProductDetail extends ProductListItem {
  variants?: ProductVariant[];
  [key: string]: unknown;
}

/** 可用筛选器 */
interface ProductFilters {
  brands: string[];
  categories: string[];
}

/** 活跃变体查询结果 */
interface ActiveVariantsResult {
  items: ProductVariant[];
  meta: { total: number; page: number; limit: number };
}

/** 变体图片载荷 */
interface VariantImagePayload {
  imageId: string;
  [key: string]: unknown;
}

/** 维度创建载荷 */
interface DimensionPayload {
  name: string;
  values?: string[];
  [key: string]: unknown;
}

/** 维度归档载荷 */
interface ArchiveDimensionPayload {
  mode?: string;
  [key: string]: unknown;
}

/** 维度影响预览载荷 */
interface DimensionImpactPayload {
  action?: string;
  dimensionId?: string;
  [key: string]: unknown;
}

/** 维度值创建载荷 */
interface DimensionValuePayload {
  value?: string;
  [key: string]: unknown;
}

/** 产品导入项 */
interface ProductImportItem {
  name?: string;
  spu?: string;
  brand?: string;
  [key: string]: unknown;
}

/** 产品导出筛选参数 */
interface ProductExportParams {
  search?: string;
  status?: string;
  brand?: string;
  category?: string;
  hasStock?: string;
  sortBy?: string;
  sortOrder?: string;
  page?: number;
  limit?: number;
}

export function useProducts() {
    const resource = useResource<ProductListItem>(API.MANAGE_PRODUCTS);
    const availableFilters = computed<ProductFilters>(() => {
      const lastFilters = resource.lastResponse.value?.filters as ProductFilters | undefined;
      return lastFilters || { brands: [], categories: [] };
    });

    const importProducts = async (items: ProductImportItem[], { importMode = 'replace' }: { importMode?: string } = {}): Promise<ApiResponse> => {
        return resource.rawRequest('/batch', {
            method: 'POST',
            body: JSON.stringify({ items, import_mode: importMode })
        });
    };

    const listProductsForExport = async ({
        search = '',
        status = '',
        brand = '',
        category = '',
        hasStock = '',
        sortBy = '',
        sortOrder = '',
        page = 1,
        limit = 100
    }: ProductExportParams = {}): Promise<ApiResponse> => {
        const params = new URLSearchParams({
            page: String(page || 1),
            limit: String(limit || 100),
        });
        if (search) params.set('search', String(search));
        if (status) params.set('status', String(status));
        if (brand) params.set('brand', String(brand));
        if (category) params.set('category', String(category));
        if (hasStock) params.set('hasStock', String(hasStock));
        if (sortBy) params.set('sortBy', String(sortBy));
        if (sortOrder) params.set('sortOrder', String(sortOrder));
        return resource.rawRequest(`?${params.toString()}`);
    };

    const loadProduct = async (id: string): Promise<ProductDetail> => {
        const res = await resource.rawRequest(`/${id}`);
        if (res.success) {
            return res.data as ProductDetail;
        }
        throw new Error(res?.error || res?.message || 'Load product failed');
    };

    const loadActiveVariants = async ({ search = '', page = 1, limit = 50 }: { search?: string; page?: number; limit?: number } = {}): Promise<ActiveVariantsResult> => {
        const params = new URLSearchParams({
            search: String(search || ''),
            page: String(page || 1),
            limit: String(limit || 50),
        });
        const res = await resource.rawRequest(`/variants?${params.toString()}`);
        if (!res.success) {
            return { items: [], meta: { total: 0, page: 1, limit: Number(limit || 50) } };
        }
        return {
            items: Array.isArray(res.data) ? res.data as ProductVariant[] : [],
            meta: (res.pagination as { total: number; page: number; limit: number }) || { total: 0, page: Number(page || 1), limit: Number(limit || 50) },
        };
    };

    const addVariantImage = async (productId: string, variantId: string, payload: VariantImagePayload): Promise<ApiResponse> => {
        return resource.rawRequest(`/${productId}/variants/${variantId}/images`, {
            method: 'POST',
            body: JSON.stringify(payload),
        });
    };

    const sortVariantImages = async (productId: string, variantId: string, imageIds: string[]): Promise<ApiResponse> => {
        return resource.rawRequest(`/${productId}/variants/${variantId}/images/sort`, {
            method: 'PATCH',
            body: JSON.stringify({ imageIds }),
        });
    };

    const setVariantPrimaryImage = async (productId: string, variantId: string, imageId: string): Promise<ApiResponse> => {
        return resource.rawRequest(`/${productId}/variants/${variantId}/images/${imageId}/primary`, {
            method: 'PATCH',
        });
    };

    const removeVariantImage = async (productId: string, variantId: string, imageId: string): Promise<ApiResponse> => {
        return resource.rawRequest(`/${productId}/variants/${variantId}/images/${imageId}`, {
            method: 'DELETE',
        });
    };

    const createDimension = async (productId: string, payload: DimensionPayload): Promise<ApiResponse> => {
        return resource.rawRequest(`/${productId}/dimensions`, {
            method: 'POST',
            body: JSON.stringify(payload),
        });
    };

    const updateDimension = async (productId: string, dimensionId: string, payload: DimensionPayload): Promise<ApiResponse> => {
        return resource.rawRequest(`/${productId}/dimensions/${dimensionId}`, {
            method: 'PATCH',
            body: JSON.stringify(payload),
        });
    };

    const archiveDimension = async (productId: string, dimensionId: string, payload: ArchiveDimensionPayload = { mode: 'archive_variants' }): Promise<ApiResponse> => {
        return resource.rawRequest(`/${productId}/dimensions/${dimensionId}/archive`, {
            method: 'PATCH',
            body: JSON.stringify(payload),
        });
    };

    const previewDimensionImpact = async (productId: string, payload: DimensionImpactPayload): Promise<ApiResponse> => {
        return resource.rawRequest(`/${productId}/dimensions/impact`, {
            method: 'POST',
            body: JSON.stringify(payload),
        });
    };

    const addDimensionValue = async (productId: string, dimensionId: string, payload: DimensionValuePayload): Promise<ApiResponse> => {
        return resource.rawRequest(`/${productId}/dimensions/${dimensionId}/values`, {
            method: 'POST',
            body: JSON.stringify(payload),
        });
    };

    const archiveDimensionValue = async (productId: string, valueId: string): Promise<ApiResponse> => {
        return resource.rawRequest(`/${productId}/values/${valueId}/archive`, {
            method: 'PATCH',
        });
    };

    const restoreDimensionValue = async (productId: string, valueId: string): Promise<ApiResponse> => {
        return resource.rawRequest(`/${productId}/values/${valueId}/restore`, {
            method: 'PATCH',
        });
    };

    const createProductWithMeta = async (payload: Record<string, unknown>): Promise<ApiResponse> => {
        const res = await resource.rawRequest('', {
            method: 'POST',
            body: JSON.stringify(payload),
        });
        if (res?.success) resource.clearCache();
        return res;
    };

    const updateProductWithMeta = async (productId: string, payload: Record<string, unknown>): Promise<ApiResponse> => {
        const res = await resource.rawRequest(`/${productId}`, {
            method: 'PATCH',
            body: JSON.stringify(payload),
        });
        if (res?.success) resource.clearCache();
        return res;
    };

    const updateProductStatus = async (productId: string, status: string): Promise<ApiResponse> => {
        const res = await resource.rawRequest(`/${productId}/status`, {
            method: 'PATCH',
            body: JSON.stringify({ status }),
        });
        if (res?.success) resource.clearCache();
        return res;
    };

    return {
        products: resource.items,
        loading: resource.loading,
        error: resource.error,
        errorCode: resource.errorCode,
        availableFilters,
        pagination: resource.pagination,
        loadProducts: resource.loadItems,
        createProduct: resource.createItem,
        updateProduct: resource.updateItem,
        deleteProduct: resource.deleteItem,
        importProducts,
        listProductsForExport,
        loadProduct,
        loadActiveVariants,
        addVariantImage,
        sortVariantImages,
        setVariantPrimaryImage,
        removeVariantImage,
        createDimension,
        updateDimension,
        archiveDimension,
        previewDimensionImpact,
        addDimensionValue,
        archiveDimensionValue,
        restoreDimensionValue,
        createProductWithMeta,
        updateProductWithMeta,
        updateProductStatus,
    };
}
