import { useResource } from './useResource';
import { API } from '@/utils/constants';

export function useProducts() {
    const resource = useResource(API.MANAGE_PRODUCTS);

    const importProducts = async (items) => {
        return resource.rawRequest('/batch', {
            method: 'POST',
            body: JSON.stringify({ items })
        });
    };

    const loadProduct = async (id) => {
        const res = await resource.rawRequest(`/${id}`);
        if (res.success) {
            return res.data;
        }
        return null;
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
        loadProduct,
        addVariantImage,
        sortVariantImages,
        setVariantPrimaryImage,
        removeVariantImage,
    };
}

