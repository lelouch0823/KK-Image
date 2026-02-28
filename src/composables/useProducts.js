import { useResource } from './useResource';
import { API } from '@/utils/constants';

export function useProducts() {
    const resource = useResource(API.MANAGE_PRODUCTS);

    const importProducts = async (items, { importMode = 'replace' } = {}) => {
        return resource.rawRequest('/batch', {
            method: 'POST',
            body: JSON.stringify({ items, import_mode: importMode })
        });
    };

    const listProductsForExport = async ({ search = '', status = '', page = 1, limit = 100 } = {}) => {
        const params = new URLSearchParams({
            page: String(page || 1),
            limit: String(limit || 100),
        });
        if (search) params.set('search', String(search));
        if (status) params.set('status', String(status));
        return resource.rawRequest(`?${params.toString()}`);
    };

    const loadProduct = async (id) => {
        const res = await resource.rawRequest(`/${id}`);
        if (res.success) {
            return res.data;
        }
        return null;
    };

    const loadActiveVariants = async ({ search = '', page = 1, limit = 50 } = {}) => {
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
            items: Array.isArray(res.data) ? res.data : [],
            meta: res.meta || { total: 0, page: Number(page || 1), limit: Number(limit || 50) },
        };
    };

    const addVariantImage = async (productId, variantId, payload) => {
        return resource.rawRequest(`/${productId}/variants/${variantId}/images`, {
            method: 'POST',
            body: JSON.stringify(payload),
        });
    };

    const sortVariantImages = async (productId, variantId, imageIds) => {
        return resource.rawRequest(`/${productId}/variants/${variantId}/images/sort`, {
            method: 'PATCH',
            body: JSON.stringify({ imageIds }),
        });
    };

    const setVariantPrimaryImage = async (productId, variantId, imageId) => {
        return resource.rawRequest(`/${productId}/variants/${variantId}/images/${imageId}/primary`, {
            method: 'PATCH',
        });
    };

    const removeVariantImage = async (productId, variantId, imageId) => {
        return resource.rawRequest(`/${productId}/variants/${variantId}/images/${imageId}`, {
            method: 'DELETE',
        });
    };

    const createDimension = async (productId, payload) => {
        return resource.rawRequest(`/${productId}/dimensions`, {
            method: 'POST',
            body: JSON.stringify(payload),
        });
    };

    const updateDimension = async (productId, dimensionId, payload) => {
        return resource.rawRequest(`/${productId}/dimensions/${dimensionId}`, {
            method: 'PATCH',
            body: JSON.stringify(payload),
        });
    };

    const archiveDimension = async (productId, dimensionId, payload = { mode: 'archive_variants' }) => {
        return resource.rawRequest(`/${productId}/dimensions/${dimensionId}/archive`, {
            method: 'PATCH',
            body: JSON.stringify(payload),
        });
    };

    const previewDimensionImpact = async (productId, payload) => {
        return resource.rawRequest(`/${productId}/dimensions/impact`, {
            method: 'POST',
            body: JSON.stringify(payload),
        });
    };

    const addDimensionValue = async (productId, dimensionId, payload) => {
        return resource.rawRequest(`/${productId}/dimensions/${dimensionId}/values`, {
            method: 'POST',
            body: JSON.stringify(payload),
        });
    };

    const archiveDimensionValue = async (productId, valueId) => {
        return resource.rawRequest(`/${productId}/values/${valueId}/archive`, {
            method: 'PATCH',
        });
    };

    const restoreDimensionValue = async (productId, valueId) => {
        return resource.rawRequest(`/${productId}/values/${valueId}/restore`, {
            method: 'PATCH',
        });
    };

    const createProductWithMeta = async (payload) => {
        return resource.rawRequest('', {
            method: 'POST',
            body: JSON.stringify(payload),
        });
    };

    const updateProductWithMeta = async (productId, payload) => {
        return resource.rawRequest(`/${productId}`, {
            method: 'PATCH',
            body: JSON.stringify(payload),
        });
    };

    return {
        products: resource.items,
        loading: resource.loading,
        error: resource.error,
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

