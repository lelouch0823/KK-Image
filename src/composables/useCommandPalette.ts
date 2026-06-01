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

// ---------- 类型定义 ----------

export interface CommandItem {
  id: string;
  label: string;
  subtitle?: string;
  icon: string;
  category: 'navigation' | 'files' | 'products' | 'orders' | 'customers' | 'actions';
  action: () => void | Promise<void>;
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
    // 导航命令
    {
      id: 'nav-dashboard',
      label: t('sidebar.dashboard'),
      icon: 'squares-2x2',
      category: 'navigation',
      action: () => router.push('/admin/dashboard'),
      permission: 'stats:read',
      keywords: ['dashboard', '概览', '仪表盘'],
    },
    {
      id: 'nav-files',
      label: t('sidebar.files'),
      icon: 'folder',
      category: 'navigation',
      action: () => router.push('/admin/files'),
      permission: 'files:read',
      keywords: ['files', '文件'],
    },
    {
      id: 'nav-spaces',
      label: t('sidebar.spaces'),
      icon: 'rectangle-group',
      category: 'navigation',
      action: () => router.push('/admin/spaces'),
      permission: 'spaces:read',
      keywords: ['spaces', '共享空间'],
    },
    {
      id: 'nav-products',
      label: t('views.products'),
      icon: 'cube',
      category: 'navigation',
      action: () => router.push('/admin/products'),
      permission: 'products:manage',
      keywords: ['products', '商品'],
    },
    {
      id: 'nav-orders',
      label: t('order.manage.title'),
      icon: 'clipboard-document-list',
      category: 'navigation',
      action: () => router.push('/admin/orders'),
      permission: 'orders:manage',
      keywords: ['orders', '订单'],
    },
    {
      id: 'nav-goods-overview',
      label: t('sidebar.goodsOverview'),
      icon: 'building-storefront',
      category: 'navigation',
      action: () => router.push('/admin/goods-overview'),
      permission: 'products:manage',
      keywords: ['goods', '订货总览'],
    },
    {
      id: 'nav-purchase-orders',
      label: t('purchaseOrder.title'),
      icon: 'shopping-cart',
      category: 'navigation',
      action: () => router.push('/admin/purchase-orders'),
      permission: 'products:manage',
      keywords: ['purchase', '采购'],
    },
    {
      id: 'nav-customers',
      label: t('customer.manage.title'),
      icon: 'users',
      category: 'navigation',
      action: () => router.push('/admin/customers'),
      permission: 'orders:manage',
      keywords: ['customers', '客户'],
    },
    {
      id: 'nav-salespersons',
      label: t('salesperson.title'),
      icon: 'briefcase',
      category: 'navigation',
      action: () => router.push('/admin/salespersons'),
      permission: 'users:read',
      keywords: ['salespersons', '销售'],
    },
    {
      id: 'nav-stats',
      label: t('sidebar.stats'),
      icon: 'chart-bar',
      category: 'navigation',
      action: () => router.push('/admin/stats'),
      permission: 'stats:read',
      keywords: ['stats', '统计'],
    },
    {
      id: 'nav-settings',
      label: t('settings.title'),
      icon: 'cog-8-tooth',
      category: 'navigation',
      action: () => router.push('/admin/settings'),
      permission: 'admin:full',
      keywords: ['settings', '设置'],
    },
    {
      id: 'nav-reminders',
      label: t('router.reminders'),
      icon: 'bell',
      category: 'navigation',
      action: () => router.push('/admin/reminders'),
      permission: 'notifications:read',
      keywords: ['reminders', '提醒'],
    },
    {
      id: 'nav-audit-logs',
      label: t('router.audit_logs'),
      icon: 'document-text',
      category: 'navigation',
      action: () => router.push('/admin/audit-logs'),
      permission: 'audit:read',
      keywords: ['audit', '审计'],
    },
    // 快捷操作
    {
      id: 'action-settings',
      label: t('commandPalette.actions.goToSettings'),
      icon: 'cog-8-tooth',
      category: 'actions',
      action: () => router.push('/admin/settings'),
      permission: 'admin:full',
      keywords: ['settings', '设置'],
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
  if (type === 'file') return (item.name as string) || '未命名文件';
  if (type === 'product') return (item.name as string) || '未命名商品';
  if (type === 'order') return (item.order_no as string) || '未知订单';
  if (type === 'customer') return (item.name as string) || '未知客户';
  return '未知';
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
  if (type === 'product') return 'cube';
  if (type === 'order') return 'clipboard-document-list';
  if (type === 'customer') return 'users';
  return 'document';
}

function navigateToEntity(
  item: Record<string, unknown>,
  type: string,
  router: ReturnType<typeof useRouter>
) {
  if (type === 'file') {
    router.push('/admin/files');
  } else if (type === 'product') {
    router.push(`/admin/products`);
  } else if (type === 'order') {
    router.push('/admin/orders');
  } else if (type === 'customer') {
    router.push('/admin/customers');
  }
}
