<template>
  <Modal
    v-model="visible"
    :title="isEditing ? t('salesperson.edit') : t('salesperson.create')"
    size="md"
  >
    <form class="space-y-5" @submit.prevent="handleSubmit">
      <!-- 姓名 -->
      <AppInput
        v-model="form.name"
        :label="t('salesperson.name')"
        :placeholder="t('salesperson.namePlaceholder')"
        required
        size="lg"
      />

      <!-- 门店 -->
      <AppInput
        v-model="form.store"
        :label="t('salesperson.store')"
        :placeholder="t('salesperson.storePlaceholder')"
        size="lg"
      />

      <!-- 电话 -->
      <AppInput
        v-model="form.phone"
        type="tel"
        :label="t('salesperson.phone')"
        :placeholder="t('salesperson.phonePlaceholder')"
        size="lg"
      />

      <!-- 密码 -->
      <div>
        <AppInput
          v-model="form.password"
          type="text"
          :label="t('salesperson.password')"
          :placeholder="isEditing ? t('salesperson.leaveBlankToKeep') : t('salesperson.passwordPlaceholder')"
          :required="!isEditing"
          :hint="t('salesperson.passwordHint')"
          size="lg"
        />
      </div>

      <!-- 状态 & 重置链接 (编辑模式) -->
      <div v-if="isEditing" class="space-y-5 border-t border-(--border-color) pt-5">
        <label class="group flex cursor-pointer items-center justify-between">
          <span
            class="group-hover:text-primary text-sm font-medium text-(--text-main) transition-colors"
          >{{ t('salesperson.activeStatus') }}</span>
          <div class="relative inline-flex cursor-pointer items-center">
            <input v-model="form.isActive" type="checkbox" class="peer sr-only" />
            <div
              class="peer h-6 w-11 rounded-full bg-(--bg-muted) transition-all peer-checked:bg-primary peer-focus:ring-primary/20 peer-focus:ring-2 peer-focus:outline-none after:absolute after:top-[2px] after:left-[2px] after:size-5 after:rounded-full after:border after:border-(--border-color) after:bg-(--bg-card) after:transition-all after:content-[''] peer-checked:after:translate-x-full peer-checked:after:border-(--bg-card)"
            ></div>
          </div>
        </label>

        <div class="flex items-center justify-between">
          <span class="text-sm text-(--text-secondary)">{{ t('salesperson.uuid') }}</span>
          <div class="flex items-center gap-2">
            <code
              class="text-primary rounded-lg border border-(--border-color) bg-(--bg-muted) px-2 py-1.5 font-mono text-xs"
            >{{ salesperson.uuid }}</code>
            <button
              type="button"
              class="text-primary px-2 py-1 text-xs font-semibold transition-colors hover:text-primary-hover hover:underline"
              @click="$emit('resetToken', salesperson.uuid)"
            >
              {{ t('salesperson.resetLink') }}
            </button>
          </div>
        </div>
      </div>
    </form>

    <template #footer>
      <AppButton
        variant="secondary"
        :text="t('common.cancel')"
        @click="visible = false"
      />
      <AppButton
        variant="primary"
        :text="submitting ? t('common.saving') : t('common.save')"
        :loading="submitting"
        @click="handleSubmit"
      />
    </template>
  </Modal>
</template>

<script setup>
import { ref, watch, computed } from 'vue';
import { useI18n } from '@/composables/useI18n';
import Modal from '@/components/ui/Modal.vue';
import AppInput from '@/components/ui/AppInput.vue';
import AppButton from '@/components/ui/AppButton.vue';

const props = defineProps({
  modelValue: {
    type: Boolean,
    default: false,
  },
  salesperson: {
    type: Object,
    default: null,
  },
  submitting: {
    type: Boolean,
    default: false,
  },
});

const emit = defineEmits(['update:modelValue', 'submit', 'resetToken']);

const { t } = useI18n();

const visible = computed({
  get: () => props.modelValue,
  set: (v) => emit('update:modelValue', v),
});

const isEditing = computed(() => !!props.salesperson);

const form = ref({
  name: '',
  store: '',
  phone: '',
  password: '',
  isActive: true,
});

// 监听 salesperson 或 visible 变化，填充/重置表单
watch(
  [() => props.salesperson, () => props.modelValue],
  ([person, visible]) => {
    // 只有当弹窗显示时才处理表单数据
    if (!visible) return;

    if (person) {
      form.value = {
        name: person.name || '',
        store: person.store || '',
        phone: person.phone || '',
        password: '',
        isActive: person.isActive !== false,
      };
    } else {
      form.value = {
        name: '',
        store: '',
        phone: '',
        password: '',
        isActive: true,
      };
    }
  },
  { immediate: true }
);

const handleSubmit = () => {
  emit('submit', {
    ...form.value,
    id: props.salesperson?.id,
  });
};
</script>
