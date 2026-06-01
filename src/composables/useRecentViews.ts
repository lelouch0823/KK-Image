/**
 * 最近访问记录管理
 * @module composables/useRecentViews
 */
import { computed, type ComputedRef } from 'vue';
import { storageGet, storageSet } from '@/utils/storage';

/** 访问记录类型 */
export type RecentViewType = 'order' | 'product' | 'customer';

/** 单条访问记录 */
export interface RecentView {
  type: RecentViewType;
  id: string;
  title: string;
  timestamp: number;
}

const STORAGE_KEY = 'kk-recent-views';
const MAX_ITEMS = 10;

// 模块级单例状态
let recentViewsData: RecentView[] | null = null;

/**
 * 获取存储的最近访问记录（懒加载）
 */
function loadViews(): RecentView[] {
  if (recentViewsData === null) {
    recentViewsData = storageGet<RecentView[]>(STORAGE_KEY, []) || [];
  }
  return recentViewsData;
}

/**
 * 持久化到 localStorage
 */
function saveViews(views: RecentView[]): void {
  recentViewsData = views;
  storageSet(STORAGE_KEY, views);
}

/**
 * 最近访问记录 composable
 * 模块级单例，所有组件共享同一份数据
 */
export function useRecentViews(): {
  recentViews: ComputedRef<RecentView[]>;
  addView: (type: RecentViewType, id: string, title: string) => void;
  removeView: (type: RecentViewType, id: string) => void;
  clearRecentViews: () => void;
} {
  /** 按时间排序的访问列表（最新在前） */
  const recentViews = computed<RecentView[]>(() => {
    return loadViews().sort((a, b) => b.timestamp - a.timestamp);
  });

  /**
   * 添加/更新访问记录
   * 按 type+id 去重，重复时移到最前面
   */
  const addView = (type: RecentViewType, id: string, title: string): void => {
    if (!id || !title) return;

    const views = loadViews();
    // 移除已有记录（去重）
    const filtered = views.filter((v) => !(v.type === type && v.id === id));
    // 在头部插入新记录
    filtered.unshift({ type, id, title, timestamp: Date.now() });
    // 截断到最大数量
    saveViews(filtered.slice(0, MAX_ITEMS));
  };

  /**
   * 移除指定记录
   */
  const removeView = (type: RecentViewType, id: string): void => {
    const views = loadViews().filter((v) => !(v.type === type && v.id === id));
    saveViews(views);
  };

  /**
   * 清空所有记录
   */
  const clearRecentViews = (): void => {
    saveViews([]);
  };

  return { recentViews, addView, removeView, clearRecentViews };
}
