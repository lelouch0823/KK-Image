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
          :placeholder="
            isEditing ? t('salesperson.leaveBlankToKeep') : t('salesperson.passwordPlaceholder')
          "
          :required="!isEditing"
          :hint="t('salesperson.passwordHint')"
          size="lg"
        />
      </div>

      <!-- 状态 & 重置链接 (编辑模式) -->
      <div v-if="isEditing" class="space-y-5 border-t border-(--border-color) pt-5">
        <div class="flex items-center justify-between gap-4">
          <div class="space-y-1">
            <span class="text-sm font-medium text-(--text-main)">{{
              t('salesperson.activeStatus')
            }}</span>
            <p class="text-xs text-(--text-secondary)">
              {{
                form.isActive
                  ? t('salesperson.active', 'Active')
                  : t('salesperson.disabled', 'Disabled')
              }}
            </p>
          </div>
          <AppCheckbox v-model="form.isActive" />
        </div>

        <div class="flex items-center justify-between">
          <span class="text-sm text-(--text-secondary)">{{ t('salesperson.uuid') }}</span>
          <div class="flex items-center gap-2">
            <code
              class="text-primary rounded-lg border border-(--border-color) bg-(--bg-muted) px-2 py-1.5 font-mono text-xs"
              >{{ salesperson.uuid }}</code
            >
            <AppButton
              type="button"
              variant="link"
              size="sm"
              class="!h-auto !px-0 text-xs font-semibold"
              @click="$emit('resetToken', salesperson.uuid)"
            >
              {{ t('salesperson.resetLink') }}
            </AppButton>
          </div>
        </div>
      </div>
    </form>

    <template #footer>
      <ActionBar class="w-full border-none bg-transparent px-0 py-0 shadow-none">
        <AppButton variant="secondary" :text="t('common.cancel')" @click="visible = false" />
        <AppButton
          variant="primary"
          :text="submitting ? t('common.saving') : t('common.save')"
          :loading="submitting"
          @click="handleSubmit"
        />
      </ActionBar>
    </template>
  </Modal>
</template>

<script setup>
import { ref, watch, computed } from 'vue';
import { useI18n } from '@/composables/useI18n';
import Modal from '@/components/ui/Modal.vue';
import AppButton from '@/components/ui/AppButton.vue';
import AppCheckbox from '@/components/ui/AppCheckbox.vue';
import AppInput from '@/components/ui/AppInput.vue';
import ActionBar from '@/design-system/composed/ActionBar.vue';

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
