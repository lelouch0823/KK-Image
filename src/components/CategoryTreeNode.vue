<template>
  <div>
    <!-- 节点行 -->
    <div
      class="group flex w-full items-center gap-1 rounded-md px-2 py-1.5 text-left text-sm transition-colors"
      :class="
        selectedId === node.id
          ? 'bg-(--color-primary-50) text-(--color-primary-700) font-medium'
          : 'text-(--text-secondary) hover:bg-(--bg-muted)'
      "
      :style="{ paddingLeft: `${level * 16 + 8}px` }"
      @click="$emit('select', node.id)"
      @contextmenu.prevent="showContextMenu = !showContextMenu"
    >
      <!-- 展开/折叠按钮 -->
      <AppButton v-if="hasChildren" variant="ghost" size="sm" @click.stop="expanded = !expanded">
        <AppIcon :name="expanded ? 'chevron-down' : 'chevron-right'" class="size-3.5" />
      </AppButton>
      <span v-else class="size-4.5 shrink-0" />

      <!-- 分类名称 -->
      <span class="min-w-0 flex-1 truncate">{{ node.name }}</span>

      <!-- 商品数量徽章 -->
      <span
        v-if="node.product_count && node.product_count > 0"
        class="shrink-0 rounded-full bg-(--bg-muted) px-1.5 py-0.5 text-xs text-(--text-muted)"
      >
        {{ node.product_count }}
      </span>

      <!-- 操作按钮（hover 显示） -->
      <div
        class="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100"
      >
        <AppButton
          variant="ghost"
          size="sm"
          :title="t('product.categoryTree.add_child')"
          @click.stop="$emit('add-child', node)"
        >
          <AppIcon name="plus" class="size-3.5" />
        </AppButton>
        <AppButton
          variant="ghost"
          size="sm"
          :title="t('product.categoryTree.edit')"
          @click.stop="$emit('edit', node)"
        >
          <AppIcon name="pencil" class="size-3.5" />
        </AppButton>
        <AppButton
          variant="ghost"
          size="sm"
          class="text-(--color-danger-500) hover:bg-(--color-danger-50)"
          :title="t('product.categoryTree.delete')"
          @click.stop="$emit('delete', node)"
        >
          <AppIcon name="trash" class="size-3.5" />
        </AppButton>
      </div>
    </div>

    <!-- 子节点（递归渲染） -->
    <div v-if="expanded && hasChildren">
      <CategoryTreeNode
        v-for="child in node.children"
        :key="child.id"
        :node="child"
        :level="level + 1"
        :selected-id="selectedId"
        @select="$emit('select', $event)"
        @edit="$emit('edit', $event)"
        @add-child="$emit('add-child', $event)"
        @delete="$emit('delete', $event)"
      />
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue';
import { useI18n } from '@/composables/useI18n';
import AppButton from '@/components/ui/AppButton.vue';
import AppIcon from '@/components/ui/AppIcon.vue';

const { t } = useI18n();

const props = defineProps({
  node: { type: Object, required: true },
  level: { type: Number, required: true },
  selectedId: { type: String, default: null },
});

defineEmits(['select', 'edit', 'add-child', 'delete']);

const expanded = ref(true);
const showContextMenu = ref(false);

const hasChildren = computed(() => props.node.children && props.node.children.length > 0);
</script>
