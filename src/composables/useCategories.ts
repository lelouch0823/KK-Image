import { ref, computed } from 'vue';
import { useResource, type ApiResponse } from './useResource';
import { API } from '@/utils/constants';

/** 分类节点 */
export interface CategoryNode {
  id: string;
  name: string;
  parent_id: string | null;
  sort_order: number;
  created_at: number;
  product_count?: number;
  children?: CategoryNode[];
}

/** 创建/更新分类载荷 */
export interface CategoryPayload {
  name: string;
  parent_id?: string | null;
  sort_order?: number;
}

export function useCategories() {
  const resource = useResource<CategoryNode>(API.MANAGE_CATEGORIES);
  const categories = ref<CategoryNode[]>([]);
  const tree = ref<CategoryNode[]>([]);
  const loading = ref(false);
  const error = ref<string | null>(null);

  /**
   * 获取所有分类（扁平列表，含商品数量）
   */
  const loadCategories = async () => {
    loading.value = true;
    error.value = null;
    try {
      const res = await resource.rawRequest('');
      if (res.success) {
        categories.value = (res.data as CategoryNode[]) || [];
      } else {
        error.value = res.error || '加载分类失败';
      }
    } catch (e: any) {
      error.value = e.message || '加载分类失败';
    } finally {
      loading.value = false;
    }
  };

  /**
   * 获取分类树结构
   */
  const loadTree = async () => {
    loading.value = true;
    error.value = null;
    try {
      const res = await resource.rawRequest('?mode=tree');
      if (res.success) {
        tree.value = (res.data as CategoryNode[]) || [];
      } else {
        error.value = res.error || '加载分类树失败';
      }
    } catch (e: any) {
      error.value = e.message || '加载分类树失败';
    } finally {
      loading.value = false;
    }
  };

  /**
   * 创建分类
   */
  const createCategory = async (payload: CategoryPayload): Promise<CategoryNode | null> => {
    try {
      const res = await resource.rawRequest('', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      if (res.success) {
        await loadCategories();
        return res.data as CategoryNode;
      }
      error.value = res.error || '创建分类失败';
      return null;
    } catch (e: any) {
      error.value = e.message || '创建分类失败';
      return null;
    }
  };

  /**
   * 更新分类
   */
  const updateCategory = async (id: string, payload: Partial<CategoryPayload>): Promise<boolean> => {
    try {
      const res = await resource.rawRequest(`/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
      });
      if (res.success) {
        await loadCategories();
        return true;
      }
      error.value = res.error || '更新分类失败';
      return false;
    } catch (e: any) {
      error.value = e.message || '更新分类失败';
      return false;
    }
  };

  /**
   * 删除分类
   */
  const deleteCategory = async (id: string): Promise<boolean> => {
    try {
      const res = await resource.rawRequest(`/${id}`, {
        method: 'DELETE',
      });
      if (res.success) {
        await loadCategories();
        return true;
      }
      error.value = res.error || '删除分类失败';
      return false;
    } catch (e: any) {
      error.value = e.message || '删除分类失败';
      return false;
    }
  };

  /**
   * 获取分类下的商品 ID 列表
   */
  const getCategoryProducts = async (categoryId: string): Promise<string[]> => {
    try {
      const res = await resource.rawRequest(`/${categoryId}/products`);
      if (res.success) {
        return (res.data as string[]) || [];
      }
      return [];
    } catch {
      return [];
    }
  };

  /**
   * 设置分类下的商品
   */
  const setCategoryProducts = async (categoryId: string, productIds: string[]): Promise<boolean> => {
    try {
      const res = await resource.rawRequest(`/${categoryId}/products`, {
        method: 'POST',
        body: JSON.stringify({ product_ids: productIds }),
      });
      return res.success;
    } catch {
      return false;
    }
  };

  /**
   * 获取商品所属的分类 ID 列表
   */
  const getProductCategories = async (productId: string): Promise<string[]> => {
    try {
      const res = await resource.rawRequest(`/product/${productId}`);
      if (res.success) {
        return (res.data as string[]) || [];
      }
      return [];
    } catch {
      return [];
    }
  };

  /**
   * 设置商品的分类
   */
  const setProductCategories = async (productId: string, categoryIds: string[]): Promise<boolean> => {
    try {
      const res = await resource.rawRequest(`/product/${productId}`, {
        method: 'POST',
        body: JSON.stringify({ category_ids: categoryIds }),
      });
      return res.success;
    } catch {
      return false;
    }
  };

  /**
   * 构建分类选项列表（用于下拉选择器，带缩进）
   */
  const categoryOptions = computed(() => {
    const options: { value: string; label: string; level: number }[] = [];
    const walk = (nodes: CategoryNode[], level: number) => {
      for (const node of nodes) {
        options.push({
          value: node.id,
          label: `${'  '.repeat(level)}${node.name}`,
          level,
        });
        if (node.children && node.children.length > 0) {
          walk(node.children, level + 1);
        }
      }
    };
    walk(tree.value, 0);
    return options;
  });

  return {
    categories,
    tree,
    loading,
    error,
    categoryOptions,
    loadCategories,
    loadTree,
    createCategory,
    updateCategory,
    deleteCategory,
    getCategoryProducts,
    setCategoryProducts,
    getProductCategories,
    setProductCategories,
  };
}
