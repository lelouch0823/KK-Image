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

    return {
        products: resource.items,
        loading: resource.loading,
        error: resource.error,
        pagination: resource.pagination,
        loadProducts: resource.loadItems,
        createProduct: resource.createItem,
        updateProduct: resource.updateItem,
        deleteProduct: resource.deleteItem,
        importProducts
    };
}

