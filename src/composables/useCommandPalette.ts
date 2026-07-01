/**
 * useCommandPalette - 全局命令面板状态管理
 *
 * 功能：
 * - 管理打开/关闭状态
 * - 注册/检索命令
 * - 键盘快捷键（⌘K / Ctrl+K）
 * - 搜索命令和远程实体
 *
 * 使用方式（全局单例）：
 * const { isOpen, open, close, toggle, commands, searchResults } = useCommandPalette();
 */
import { ref, computed, watch, onScopeDispose } from 'vue';
import { useRouter } from 'vue-router';
import { useAuth } from '@/composables/useAuth';
import { useAccessControl } from '@/composables/useAccessControl';
import { useI18n } from '@/composables/useI18n';
import {
  getAdminFeatureByEntityType,
  getAdminFeaturePath,
  getCommandAdminFeatures,
} from '@/config/admin-features';

// ---------- 类型定义 ----------

export interface CommandItem {
  id: string;
  label: string;
  subtitle?: string;
  icon: string;
  category: 'navigation' | 'files' | 'products' | 'orders' | 'customers' | 'actions';
  action: () => void | Promise<unknown>;
  permission?: string;
  keywords?: string[];
}

export interface SearchResult {
  id: string;
  title: string;
  subtitle?: string;
  type: 'file' | 'product' | 'order' | 'customer';
  icon: string;
  action: () => void;
}

// ---------- 全局单例状态 ----------

const isOpen = ref(false);
const query = ref('');
const selectedIndex = ref(0);
const searchResults = ref<SearchResult[]>([]);
const isSearching = ref(false);

let searchTimeout: ReturnType<typeof setTimeout> | null = null;

// ---------- 打开/关闭 ----------

export function useCommandPalette() {
  const router = useRouter();
  const { authFetch } = useAuth();
  const { hasPermission, permissionsLoaded } = useAccessControl();
  const { t } = useI18n();

  const open = () => {
    isOpen.value = true;
    query.value = '';
    selectedIndex.value = 0;
    searchResults.value = [];
  };

  const close = () => {
    isOpen.value = false;
    query.value = '';
    selectedIndex.value = 0;
    searchResults.value = [];
    if (searchTimeout) {
      clearTimeout(searchTimeout);
      searchTimeout = null;
    }
  };

  const toggle = () => {
    if (isOpen.value) {
      close();
    } else {
      open();
    }
  };

  // ---------- 内置命令注册 ----------

  const builtinCommands = computed<CommandItem[]>(() => [
    ...getCommandAdminFeatures().map((feature) => ({
      id: `nav-${feature.key}`,
      label: t(feature.commandLabelKey || feature.labelKey),
      icon: feature.icon,
      category: 'navigation' as const,
      action: () => router.push(getAdminFeaturePath(feature.key)),
      permission: feature.permission,
      keywords: feature.commandKeywords || [],
    })),
    // 快捷操作
    {
      id: 'action-settings',
      label: t('commandPalette.actions.goToSettings'),
      icon: 'cog-8-tooth',
      category: 'actions',
      action: () => router.push('/admin/settings'),
      permission: 'admin:full',
      keywords: ['settings', t('sidebar.settings', '设置')],
    },
  ]);

  // 过滤有权限的命令
  const availableCommands = computed<CommandItem[]>(() => {
    if (!permissionsLoaded.value) return [];
    return builtinCommands.value.filter((cmd) => {
      if (!cmd.permission) return true;
      return hasPermission(cmd.permission);
    });
  });

  // ---------- 本地命令过滤 ----------

  const filteredCommands = computed<CommandItem[]>(() => {
    const q = query.value.trim().toLowerCase();
    if (!q) return availableCommands.value;

    return availableCommands.value.filter((cmd) => {
      const haystack = [cmd.label, cmd.subtitle || '', ...(cmd.keywords || [])]
        .join(' ')
        .toLowerCase();
      return haystack.includes(q);
    });
  });

  // ---------- 远程搜索 ----------

  const performRemoteSearch = async (q: string) => {
    if (!q || q.length < 2) {
      searchResults.value = [];
      return;
    }

    isSearching.value = true;
    try {
      const res = await authFetch(`/api/manage/search?q=${encodeURIComponent(q)}&scope=all`);
      const data = await res.json();
      if (data.success && Array.isArray(data.data)) {
        searchResults.value = data.data.map((item: Record<string, unknown>) => {
          const type = item.result_type as string;
          return {
            id: `${type}-${item.id}`,
            title: getTitle(item, type),
            subtitle: getSubtitle(item, type),
            type,
            icon: getIcon(type),
            action: () => navigateToEntity(item, type, router),
          } as SearchResult;
        });
      }
    } catch (_err) {
      // 搜索失败静默处理
      searchResults.value = [];
    } finally {
      isSearching.value = false;
    }
  };

  // 监听查询变化，防抖远程搜索
  watch(query, (newVal) => {
    if (searchTimeout) clearTimeout(searchTimeout);
    if (!newVal || newVal.trim().length < 2) {
      searchResults.value = [];
      return;
    }
    searchTimeout = setTimeout(() => performRemoteSearch(newVal.trim()), 300);
  });

  // ---------- 合并结果（命令优先，然后是搜索结果） ----------

  const allResults = computed(() => {
    const items: Array<{ type: 'command' | 'search'; data: CommandItem | SearchResult }> = [];

    // 本地命令匹配
    for (const cmd of filteredCommands.value) {
      items.push({ type: 'command', data: cmd });
    }

    // 远程搜索结果（仅在有查询时追加）
    if (query.value.trim()) {
      for (const result of searchResults.value) {
        items.push({ type: 'search', data: result });
      }
    }

    return items;
  });

  const totalResults = computed(() => allResults.value.length);

  // ---------- 键盘导航 ----------

  const moveUp = () => {
    if (selectedIndex.value > 0) {
      selectedIndex.value--;
    } else {
      selectedIndex.value = totalResults.value - 1;
    }
  };

  const moveDown = () => {
    if (selectedIndex.value < totalResults.value - 1) {
      selectedIndex.value++;
    } else {
      selectedIndex.value = 0;
    }
  };

  const executeSelected = () => {
    const item = allResults.value[selectedIndex.value];
    if (!item) return;

    if (item.type === 'command') {
      (item.data as CommandItem).action();
    } else {
      (item.data as SearchResult).action();
    }
    close();
  };

  // 选择索引重置
  watch(query, () => {
    selectedIndex.value = 0;
  });

  // 清理
  onScopeDispose(() => {
    if (searchTimeout) {
      clearTimeout(searchTimeout);
      searchTimeout = null;
    }
  });

  return {
    // 状态
    isOpen,
    query,
    selectedIndex,
    isSearching,
    searchResults,
    filteredCommands,
    allResults,
    totalResults,

    // 方法
    open,
    close,
    toggle,
    moveUp,
    moveDown,
    executeSelected,
  };
}

// ---------- 辅助函数 ----------

function getTitle(item: Record<string, unknown>, type: string): string {
  const { t } = useI18n();
  if (type === 'file') return (item.name as string) || t('commandPalette.fallbacks.unnamedFile');
  if (type === 'product') return (item.name as string) || t('commandPalette.fallbacks.unnamedProduct');
  if (type === 'order') return (item.order_no as string) || t('commandPalette.fallbacks.unknownOrder');
  if (type === 'customer') return (item.name as string) || t('commandPalette.fallbacks.unknownCustomer');
  return t('commandPalette.fallbacks.unknown');
}

function getSubtitle(item: Record<string, unknown>, type: string): string {
  if (type === 'file') return (item.path as string) || '';
  if (type === 'product') return (item.sku as string) || '';
  if (type === 'order') return (item.customer_name as string) || '';
  if (type === 'customer') return (item.phone as string) || '';
  return '';
}

function getIcon(type: string): string {
  if (type === 'file') return 'photo';
  const feature = getAdminFeatureByEntityType(type);
  if (feature) return feature.icon;
  return 'document';
}

function navigateToEntity(
  item: Record<string, unknown>,
  type: string,
  router: ReturnType<typeof useRouter>
) {
  if (type === 'file') {
    router.push(getAdminFeaturePath('files'));
    return;
  }

  const feature = getAdminFeatureByEntityType(type);
  if (feature) {
    router.push(getAdminFeaturePath(feature.key));
  }
}
