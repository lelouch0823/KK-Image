/**
 * useModalStack - 智能 Modal 堆叠管理器
 *
 * 功能：
 * - 追踪当前打开的 Modal 数量
 * - 智能控制毛玻璃效果（仅最顶层 Modal 显示）
 * - 根据打开顺序动态分配 z-index
 * - 支持 ESC 键优先关闭最顶层等逻辑
 *
 * 使用方式：
 * const { register, unregister, shouldShowBlur, getZIndex } = useModalStack();
 */
import { ref, computed } from 'vue';

// 全局状态：存储当前打开的 Modal ID 列表（按打开顺序）
const openModals = ref<string[]>([]);

// z-index 配置
const BASE_Z_INDEX = 100; // 基础层级（高于侧边栏 z-50）
const Z_INDEX_STEP = 10; // 每层递增

/**
 * 生成唯一 Modal ID
 */
const generateModalId = (): string => {
  return `modal-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
};

/**
 * useModalStack composable
 */
export function useModalStack() {
  /**
   * 注册 Modal（打开时调用）
   * @param id - Modal 唯一标识
   */
  const register = (id: string): void => {
    if (!openModals.value.includes(id)) {
      openModals.value.push(id);
    }
  };

  /**
   * 注销 Modal（关闭时调用）
   * @param id - Modal 唯一标识
   */
  const unregister = (id: string): void => {
    const index = openModals.value.indexOf(id);
    if (index > -1) {
      openModals.value.splice(index, 1);
    }
  };

  /**
   * 判断指定 Modal 是否为最顶层
   * 用于 ESC 键优先关闭最顶层等逻辑
   * @param id - Modal 唯一标识
   */
  const isTopModal = (id: string): boolean => {
    const len = openModals.value.length;
    return len > 0 && openModals.value[len - 1] === id;
  };

  /**
   * 判断指定 Modal 是否应显示毛玻璃效果
   * 逻辑：只有最顶层 Modal 显示毛玻璃，底层不显示
   * @param id - Modal 唯一标识
   */
  const shouldShowBlur = (id: string): boolean => {
    return isTopModal(id);
  };

  /**
   * 获取指定 Modal 的动态 z-index
   * 根据打开顺序自动计算：第一个 100，第二个 110，第三个 120...
   * 注意：如果 Modal 尚未注册（computed 先于 watch 执行），返回下一个可用层级
   * @param id - Modal 唯一标识
   * @returns z-index 值
   */
  const getZIndex = (id: string): number => {
    const index = openModals.value.indexOf(id);
    if (index === -1) {
      // 未注册的 Modal：返回下一个可用层级（当前栈大小对应的层级）
      // 这解决了 computed 先于 watch 执行导致的时序问题
      return BASE_Z_INDEX + openModals.value.length * Z_INDEX_STEP;
    }
    return BASE_Z_INDEX + index * Z_INDEX_STEP;
  };

  /**
   * 当前打开的 Modal 数量
   */
  const modalCount = computed(() => openModals.value.length);

  /**
   * 是否有 Modal 正在打开
   */
  const hasOpenModals = computed(() => openModals.value.length > 0);

  /**
   * 获取当前堆叠深度（用于调试）
   * @param id - Modal 唯一标识
   * @returns 从 0 开始的索引
   */
  const getStackIndex = (id: string): number => {
    return openModals.value.indexOf(id);
  };

  return {
    generateModalId,
    register,
    unregister,
    isTopModal,
    shouldShowBlur,
    getZIndex,
    modalCount,
    hasOpenModals,
    getStackIndex,
  };
}
