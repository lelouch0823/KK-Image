import { computed } from 'vue';
import { useResource } from './useResource';
import { API } from '@/utils/constants';

export function useProducts() {
    const resource = useResource(API.MANAGE_PRODUCTS);
    const availableFilters = computed(() => resource.lastResponse.value?.filters || { brands: [], categories: [] });

    const importProducts = async (items: any[], { importMode = 'replace' }: { importMode?: string } = {}): Promise<any> => {
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
    }: Record<string, any> = {}): Promise<any> => {
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

    const loadProduct = async (id: string): Promise<any> => {
        const res: any = await resource.rawRequest(`/${id}`);
        if (res.success) {
            return res.data;
        }
        throw new Error(res?.error || res?.message || 'Load product failed');
    };

    const loadActiveVariants = async ({ search = '', page = 1, limit = 50 }: Record<string, any> = {}): Promise<any> => {
        const params = new URLSearchParams({
            search: String(search || ''),
            page: String(page || 1),
            limit: String(limit || 50),
        });
        const res: any = await resource.rawRequest(`/variants?${params.toString()}`);
        if (!res.success) {
            return { items: [], meta: { total: 0, page: 1, limit: Number(limit || 50) } };
        }
        return {
            items: Array.isArray(res.data) ? res.data : [],
            meta: res.pagination || { total: 0, page: Number(page || 1), limit: Number(limit || 50) },
        };
    };

    const addVariantImage = async (productId: string, variantId: string, payload: any): Promise<any> => {
        return resource.rawRequest(`/${productId}/variants/${variantId}/images`, {
            method: 'POST',
            body: JSON.stringify(payload),
        });
    };

    const sortVariantImages = async (productId: string, variantId: string, imageIds: string[]): Promise<any> => {
        return resource.rawRequest(`/${productId}/variants/${variantId}/images/sort`, {
            method: 'PATCH',
            body: JSON.stringify({ imageIds }),
        });
    };

    const setVariantPrimaryImage = async (productId: string, variantId: string, imageId: string): Promise<any> => {
        return resource.rawRequest(`/${productId}/variants/${variantId}/images/${imageId}/primary`, {
            method: 'PATCH',
        });
    };

    const removeVariantImage = async (productId: string, variantId: string, imageId: string): Promise<any> => {
        return resource.rawRequest(`/${productId}/variants/${variantId}/images/${imageId}`, {
            method: 'DELETE',
        });
    };

    const createDimension = async (productId: string, payload: any): Promise<any> => {
        return resource.rawRequest(`/${productId}/dimensions`, {
            method: 'POST',
            body: JSON.stringify(payload),
        });
    };

    const updateDimension = async (productId: string, dimensionId: string, payload: any): Promise<any> => {
        return resource.rawRequest(`/${productId}/dimensions/${dimensionId}`, {
            method: 'PATCH',
            body: JSON.stringify(payload),
        });
    };

    const archiveDimension = async (productId: string, dimensionId: string, payload: any = { mode: 'archive_variants' }): Promise<any> => {
        return resource.rawRequest(`/${productId}/dimensions/${dimensionId}/archive`, {
            method: 'PATCH',
            body: JSON.stringify(payload),
        });
    };

    const previewDimensionImpact = async (productId: string, payload: any): Promise<any> => {
        return resource.rawRequest(`/${productId}/dimensions/impact`, {
            method: 'POST',
            body: JSON.stringify(payload),
        });
    };

    const addDimensionValue = async (productId: string, dimensionId: string, payload: any): Promise<any> => {
        return resource.rawRequest(`/${productId}/dimensions/${dimensionId}/values`, {
            method: 'POST',
            body: JSON.stringify(payload),
        });
    };

    const archiveDimensionValue = async (productId: string, valueId: string): Promise<any> => {
        return resource.rawRequest(`/${productId}/values/${valueId}/archive`, {
            method: 'PATCH',
        });
    };

    const restoreDimensionValue = async (productId: string, valueId: string): Promise<any> => {
        return resource.rawRequest(`/${productId}/values/${valueId}/restore`, {
            method: 'PATCH',
        });
    };

    const createProductWithMeta = async (payload: any): Promise<any> => {
        const res: any = await resource.rawRequest('', {
            method: 'POST',
            body: JSON.stringify(payload),
        });
        if (res?.success) resource.clearCache();
        return res;
    };

    const updateProductWithMeta = async (productId: string, payload: any): Promise<any> => {
        const res: any = await resource.rawRequest(`/${productId}`, {
            method: 'PATCH',
            body: JSON.stringify(payload),
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
    };
}
