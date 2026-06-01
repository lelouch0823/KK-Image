<template>
  <Teleport to="body">
    <transition
      enter-active-class="transition ease-out-expo duration-200"
      enter-from-class="opacity-0"
      enter-to-class="opacity-100"
      leave-active-class="transition duration-150"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0"
    >
      <div
        v-if="isOpen"
        class="fixed inset-0 z-[200] flex items-start justify-center px-4 pt-[20vh]"
        :style="{ backgroundColor: 'var(--color-overlay-dim)' }"
        @click.self="close"
      >
        <transition
          enter-active-class="transition ease-out-expo duration-200"
          enter-from-class="opacity-0 scale-[0.97] translate-y-3"
          enter-to-class="opacity-100 scale-100 translate-y-0"
          leave-active-class="transition duration-150"
          leave-from-class="opacity-100 scale-100 translate-y-0"
          leave-to-class="opacity-0 scale-[0.97] translate-y-2"
        >
          <div
            v-if="isOpen"
            role="dialog"
            aria-modal="true"
            :aria-label="t('commandPalette.placeholder')"
            class="w-full max-w-2xl overflow-hidden rounded-xl border shadow-2xl"
            :style="{
              backgroundColor: 'var(--color-modal-bg)',
              borderColor: 'var(--border-color)',
            }"
            @keydown="handleKeydown"
          >
            <!-- 搜索输入框 -->
            <div
              class="flex items-center gap-3 border-b px-4 py-3"
              :style="{ borderColor: 'var(--border-color)' }"
            >
              <AppIcon
                name="magnifying-glass"
                class="size-5 shrink-0"
                :class="isSearching ? 'animate-pulse' : ''"
                :style="{ color: 'var(--text-muted)' }"
              />
              <input
                ref="searchInput"
                v-model="query"
                type="text"
                :placeholder="t('commandPalette.placeholder')"
                class="flex-1 bg-transparent text-sm outline-none placeholder:opacity-50"
                :style="{ color: 'var(--text-main)' }"
                @keydown.down.prevent="moveDown"
                @keydown.up.prevent="moveUp"
                @keydown.enter.prevent="executeSelected"
                @keydown.escape.prevent="close"
              />
              <kbd
                class="hidden rounded border px-1.5 py-0.5 text-[10px] font-medium sm:inline-block"
                :style="{
                  borderColor: 'var(--border-color)',
                  color: 'var(--text-muted)',
                  backgroundColor: 'var(--bg-muted)',
                }"
              >
                ESC
              </kbd>
            </div>

            <!-- 结果列表 -->
            <div
              ref="resultsContainer"
              class="scrollbar-thin max-h-[50vh] overflow-y-auto overscroll-contain"
            >
              <!-- 空状态 -->
              <div
                v-if="allResults.length === 0 && query.trim()"
                class="flex flex-col items-center justify-center py-10"
              >
                <AppIcon
                  name="magnifying-glass"
                  class="mb-3 size-10"
                  :style="{ color: 'var(--text-muted)' }"
                />
                <p class="text-sm font-medium" :style="{ color: 'var(--text-secondary)' }">
                  {{ t('commandPalette.noResults') }}
                </p>
                <p class="mt-1 text-xs" :style="{ color: 'var(--text-muted)' }">
                  {{ t('commandPalette.noResultsDesc') }}
                </p>
              </div>

              <!-- 无查询时显示所有命令 -->
              <template v-if="allResults.length > 0">
                <template v-for="(group, groupIndex) in groupedResults" :key="group.category">
                  <!-- 分组标题 -->
                  <div
                    class="sticky top-0 z-10 px-4 py-1.5 text-[11px] font-medium tracking-wider uppercase"
                    :style="{
                      backgroundColor: 'var(--bg-muted)',
                      color: 'var(--text-muted)',
                    }"
                  >
                    {{ t(`commandPalette.categories.${group.category}`) }}
                  </div>
                  <!-- 命令项 -->
                  <button
                    v-for="(item, itemIndex) in group.items"
                    :key="item.id"
                    type="button"
                    class="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm transition-colors"
                    :style="{
                      color: 'var(--text-main)',
                      backgroundColor:
                        getGlobalIndex(groupIndex, itemIndex) === selectedIndex
                          ? 'var(--bg-active)'
                          : 'transparent',
                    }"
                    @click="handleItemClick(item)"
                    @mouseenter="selectedIndex = getGlobalIndex(groupIndex, itemIndex)"
                  >
                    <AppIcon
                      :name="item.icon"
                      class="size-5 shrink-0"
                      :style="{ color: 'var(--text-secondary)' }"
                    />
                    <div class="min-w-0 flex-1">
                      <div class="truncate font-medium">{{ item.title }}</div>
                      <div
                        v-if="item.subtitle"
                        class="truncate text-xs"
                        :style="{ color: 'var(--text-muted)' }"
                      >
                        {{ item.subtitle }}
                      </div>
                    </div>
                    <span
                      v-if="item.badge"
                      class="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium"
                      :style="{
                        backgroundColor: 'var(--bg-secondary)',
                        color: 'var(--text-secondary)',
                      }"
                    >
                      {{ item.badge }}
                    </span>
                  </button>
                </template>
              </template>
            </div>

            <!-- 底部提示 -->
            <div
              class="flex items-center gap-4 border-t px-4 py-2 text-[11px]"
              :style="{
                borderColor: 'var(--border-color)',
                color: 'var(--text-muted)',
                backgroundColor: 'var(--bg-muted)',
              }"
            >
              <span class="flex items-center gap-1">
                <kbd
                  class="inline-block rounded border px-1 py-0.5 text-[10px]"
                  :style="{ borderColor: 'var(--border-color)' }"
                >
                  &uarr;
                </kbd>
                <kbd
                  class="inline-block rounded border px-1 py-0.5 text-[10px]"
                  :style="{ borderColor: 'var(--border-color)' }"
                >
                  &darr;
                </kbd>
                {{ t('commandPalette.hints.navigate') }}
              </span>
              <span class="flex items-center gap-1">
                <kbd
                  class="inline-block rounded border px-1 py-0.5 text-[10px]"
                  :style="{ borderColor: 'var(--border-color)' }"
                >
                  &crarr;
                </kbd>
                {{ t('commandPalette.hints.select') }}
              </span>
              <span class="flex items-center gap-1">
                <kbd
                  class="inline-block rounded border px-1 py-0.5 text-[10px]"
                  :style="{ borderColor: 'var(--border-color)' }"
                >
                  Esc
                </kbd>
                {{ t('commandPalette.hints.close') }}
              </span>
            </div>
          </div>
        </transition>
      </div>
    </transition>
  </Teleport>
</template>

<script setup>
import { ref, watch, nextTick, onMounted, onUnmounted, computed } from 'vue';
import { useCommandPalette } from '@/composables/useCommandPalette';
import { useI18n } from '@/composables/useI18n';
import AppIcon from '@/components/ui/AppIcon.vue';

const { isOpen, query, selectedIndex, isSearching, allResults, close, moveUp, moveDown, executeSelected } =
  useCommandPalette();
const { t } = useI18n();

const searchInput = ref(null);
const resultsContainer = ref(null);

// 将 allResults 按 category 分组
const groupedResults = computed(() => {
  const groups = new Map();

  for (const item of allResults.value) {
    const category = item.type === 'command' ? item.data.category : getCategoryFromType(item.data.type);
    if (!groups.has(category)) {
      groups.set(category, { category, items: [] });
    }
    const group = groups.get(category);
    group.items.push({
      id: item.data.id,
      title: item.type === 'command' ? item.data.label : item.data.title,
      subtitle: item.type === 'command' ? item.data.subtitle : item.data.subtitle,
      icon: item.data.icon,
      badge: item.type === 'search' ? getCategoryFromType(item.data.type) : null,
      _item: item,
    });
  }

  return Array.from(groups.values());
});

// 计算全局索引
const flatIndexMap = computed(() => {
  const map = [];
  for (let gi = 0; gi < groupedResults.value.length; gi++) {
    for (let ii = 0; ii < groupedResults.value[gi].items.length; ii++) {
      map.push({ gi, ii });
    }
  }
  return map;
});

const getGlobalIndex = (groupIndex, itemIndex) => {
  return flatIndexMap.value.findIndex((m) => m.gi === groupIndex && m.ii === itemIndex);
};

function getCategoryFromType(type) {
  if (type === 'file') return 'files';
  if (type === 'product') return 'products';
  if (type === 'order') return 'orders';
  if (type === 'customer') return 'customers';
  return 'actions';
}

function handleItemClick(item) {
  const original = item._item;
  if (original.type === 'command') {
    original.data.action();
  } else {
    original.data.action();
  }
  close();
}

// 打开时聚焦输入框
watch(isOpen, (val) => {
  if (val) {
    nextTick(() => {
      searchInput.value?.focus();
    });
  }
});

// 滚动到选中项
watch(selectedIndex, () => {
  nextTick(() => {
    const container = resultsContainer.value;
    if (!container) return;
    const buttons = container.querySelectorAll('button');
    const selected = buttons[selectedIndex.value];
    if (selected) {
      selected.scrollIntoView({ block: 'nearest' });
    }
  });
});

// 全局快捷键 ⌘K / Ctrl+K
const handleGlobalKeydown = (e) => {
  if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
    e.preventDefault();
    if (isOpen.value) {
      close();
    } else {
      // 仅在已登录状态打开（不在登录页等）
      const path = window.location.pathname;
      if (path.startsWith('/admin')) {
        const { open } = useCommandPalette();
        open();
      }
    }
  }
};

// 处理键盘事件（防止在输入框中拦截）
const handleKeydown = (e) => {
  if (e.key === 'Escape') {
    e.preventDefault();
    close();
  }
};

onMounted(() => {
  document.addEventListener('keydown', handleGlobalKeydown);
});

onUnmounted(() => {
  document.removeEventListener('keydown', handleGlobalKeydown);
});
</script>
