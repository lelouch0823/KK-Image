<template>
  <div class="category-tree">
    <!-- 头部：标题 + 添加按钮 -->
    <div class="mb-3 flex items-center justify-between">
      <h3 class="text-sm font-semibold text-(--text-main)">{{ t('product.categoryTree.title') }}</h3>
      <AppButton
        variant="ghost"
        size="sm"
        :title="t('product.categoryTree.add')"
        @click="$emit('add')"
      >
        <AppIcon name="plus" class="size-4" />
      </AppButton>
    </div>

    <!-- 全部商品选项 -->
    <AppButton
      variant="ghost"
      block
      class="mb-1 justify-start"
      :class="selectedId === null
        ? 'bg-(--color-primary-50) text-(--color-primary-700) font-medium'
        : ''"
      :text="t('product.categoryTree.all')"
      @click="$emit('select', null)"
    >
      <template #icon-left>
        <AppIcon name="squares-2x2" class="size-4 shrink-0" />
      </template>
      <template v-if="totalProductCount > 0" #icon-right>
        <span class="text-xs text-(--text-muted)">{{ totalProductCount }}</span>
      </template>
    </AppButton>

    <!-- 树节点列表 -->
    <div v-if="nodes.length > 0" class="space-y-0.5">
      <CategoryTreeNode
        v-for="node in nodes"
        :key="node.id"
        :node="node"
        :level="0"
        :selected-id="selectedId"
        @select="$emit('select', $event)"
        @edit="$emit('edit', $event)"
        @add-child="$emit('add-child', $event)"
        @delete="$emit('delete', $event)"
      />
    </div>

    <!-- 空状态 -->
    <div v-else class="py-6 text-center text-sm text-(--text-muted)">
      {{ t('product.categoryTree.empty') }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from '@/composables/useI18n';
import AppButton from '@/components/ui/AppButton.vue';
import AppIcon from '@/components/ui/AppIcon.vue';
import CategoryTreeNode from './CategoryTreeNode.vue';
import type { CategoryNode } from '@/composables/useCategories';

const { t } = useI18n();

defineProps<{
  nodes: CategoryNode[];
  selectedId: string | null;
  totalProductCount?: number;
}>();

defineEmits<{
  select: [id: string | null];
  edit: [node: CategoryNode];
  'add-child': [node: CategoryNode];
  delete: [node: CategoryNode];
  add: [];
}>();
</script>
