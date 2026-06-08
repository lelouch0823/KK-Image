<template>
  <div class="inline-block">
    <AppButton
      type="button"
      :disabled="loading"
      variant="white"
      size="sm"
      class="min-w-[4.25rem] justify-center whitespace-nowrap rounded-full border text-center shadow-sm"
      :class="[currentStatusClass, showChevron ? 'relative pl-3 pr-8' : 'px-3.5']"
      @click="openModal"
    >
      <template #icon-left>
        <span class="size-2 rounded-full" :class="getStatusDotColor(status)"></span>
      </template>
      <span class="max-w-[4.5rem] truncate">{{ formatOrderStatusLabel(t, status) }}</span>
      <template v-if="showChevron" #icon-right>
        <AppIcon name="chevron-up-down" class="absolute right-3 size-3.5 opacity-60" />
      </template>
    </AppButton>

    <Modal v-model="showModal" size="md" body-class="!p-0" @close="closeModal">
      <template #header>
        <div class="flex flex-1 items-start justify-between gap-4">
          <div class="min-w-0">
            <h3 class="text-lg font-bold text-(--text-main)">
              {{ t('order.manage.changeStatus') }}
            </h3>
            <p class="mt-1 text-sm text-(--text-secondary)">
              {{ t('order.manage.currentStatus') }}:
              <StatusBadge
                class="ml-1 align-middle"
                :variant="getStatusVariant(status)"
                :label="formatOrderStatusLabel(t, status)"
              />
            </p>
          </div>
          <AppButton variant="ghost" size="sm" class="!h-9 !w-9 !px-0" @click="closeModal">
            <AppIcon name="x-mark" class="size-5" />
          </AppButton>
        </div>
      </template>

      <div class="space-y-4 p-6">
        <div class="rounded-xl border border-info/20 bg-info/5 px-3 py-2" aria-live="polite">
          <p class="text-info text-xs">{{ t(friendlyTipKey) }}</p>
        </div>
        <p v-if="!canUseForceOverride" class="text-xs text-(--text-secondary)">
          {{ t('order.manage.friendlyNoPermissionTip') }}
        </p>

        <div class="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <AppButton
            v-for="s in orderedStatusOptions"
            :key="s"
            type="button"
            block
            variant="white"
            size="sm"
            :disabled="isStatusDisabled(s)"
            :aria-label="getStatusButtonAriaLabel(s)"
            class="!h-auto !justify-start !rounded-xl !border-2 !px-4 !py-3 text-left"
            :class="[
              selectedStatus === s
                ? '!border-primary bg-primary/5 ring-2 ring-primary/20'
                : '!border-(--border-color) hover:!border-(--border-hover) hover:!bg-(--bg-hover)',
              isOutOfFlowStatus(s) ? 'border-warning/40' : '',
            ]"
            @click="selectedStatus = s"
          >
            <template #icon-left>
              <span
                class="size-3 shrink-0 rounded-full ring-2 ring-offset-1"
                :class="[
                  getStatusDotColor(s),
                  selectedStatus === s ? 'ring-current/30' : 'ring-transparent',
                ]"
              ></span>
            </template>
            {{ formatOrderStatusLabel(t, s) }}
            <template #icon-right>
              <div
                class="ml-auto flex items-center gap-2"
                :class="{
                  'text-warning': isBlockedStatus(s) || isOutOfFlowStatus(s),
                  'text-success':
                    !isBlockedStatus(s) && !isOutOfFlowStatus(s) && s !== props.status,
                }"
              >
                <StatusBadge
                  :variant="resolveTagVariant(s)"
                  :label="getStatusTagText(s)"
                  class="text-xs"
                />
                <AppIcon v-if="selectedStatus === s" name="check" class="size-4 text-primary" />
              </div>
            </template>
          </AppButton>
        </div>

        <div>
          <label class="mb-2 block text-xs font-medium text-(--text-secondary)">
            {{ t('order.manage.statusNote') }}
            <span v-if="!requiresForceOverride" class="text-(--text-muted)">
              ({{ t('common.optional') }})
            </span>
            <span v-else class="text-danger">*</span>
          </label>
          <AppInput
            ref="noteInput"
            v-model="statusNote"
            :placeholder="t('order.manage.statusNotePlaceholder')"
            :aria-required="requiresForceOverride ? 'true' : 'false'"
            @keyup.enter="handleConfirm"
          />
          <p
            v-if="requiresForceOverride && !forceReasonValid"
            role="alert"
            class="text-warning mt-2 text-xs"
          >
            {{ t('order.manage.forceReasonRequired') }}
          </p>
        </div>

        <div v-if="requiresForceOverride">
          <div aria-live="polite" class="rounded-xl border border-warning/30 bg-warning/10 p-3">
            <p class="text-sm text-(--text-main)">
              {{ t('order.manage.forceTransitionWarning') }}
            </p>
            <label class="mt-2 flex items-center gap-2 text-sm text-(--text-main)">
              <AppCheckbox v-model="forceOverrideConfirmed" :disabled="!canUseForceOverride" />
              <span v-if="canUseForceOverride">
                {{ t('order.manage.forceTransitionConfirm') }}
              </span>
              <span v-else class="text-danger">
                {{ t('order.manage.forceTransitionNoPermission') }}
              </span>
            </label>
          </div>
        </div>

        <div v-if="isDangerousStatus">
          <div
            aria-live="polite"
            class="flex items-start gap-2 rounded-xl border border-danger/20 bg-danger/5 p-3"
          >
            <AppIcon name="exclamation-triangle" class="text-danger mt-0.5 size-5 shrink-0" />
            <p class="text-danger text-xs">
              {{ t('order.manage.dangerousStatusWarning') }}
            </p>
          </div>
        </div>
      </div>

      <template #footer>
        <ActionBar class="border-none bg-transparent px-0 py-0 shadow-none">
          <template #leading>
            <span class="text-xs text-(--text-secondary)">
              {{ t('order.manage.transitionHint') }}
            </span>
          </template>
          <AppButton type="button" variant="secondary" :disabled="submitting" @click="closeModal">
            {{ t('common.cancel') }}
          </AppButton>
          <AppButton
            type="button"
            :variant="isDangerousStatus ? 'danger' : 'primary'"
            :disabled="!canConfirm"
            :loading="submitting"
            @click="handleConfirm"
          >
            {{ t('common.confirm') }}
          </AppButton>
        </ActionBar>
      </template>
    </Modal>
  </div>
</template>

<script setup>
import { ref, computed, watch, nextTick } from 'vue';
import { useI18n } from '@/composables/useI18n';
import ActionBar from '@/design-system/composed/ActionBar.vue';
import AppButton from '@/components/ui/AppButton.vue';
import AppCheckbox from '@/components/ui/AppCheckbox.vue';
import AppIcon from '@/components/ui/AppIcon.vue';
import AppInput from '@/components/ui/AppInput.vue';
import Modal from '@/components/ui/Modal.vue';
import StatusBadge from '@/components/ui/StatusBadge.vue';
import { STATUS_OPTIONS, STATUS_STYLES, STATUS_DOTS, getStatusVariant } from '@/utils/status';
import {
  getAllowedOrderTransitions,
  hasForceStatusPermission,
  isHighRiskOrderStatus,
} from '@/utils/order-state-machine';
import { formatOrderStatusLabel } from '@/utils/display-labels';

const props = defineProps({
  status: { type: String, required: true },
  loading: Boolean,
  permissions: { type: Array, default: () => [] },
  showChevron: { type: Boolean, default: true },
  canDeliver: { type: Boolean, default: true },
  onStatusChange: { type: Function, default: null },
});

const emit = defineEmits(['change']);

const { t } = useI18n();

const showModal = ref(false);
const selectedStatus = ref('');
const statusNote = ref('');
const forceOverrideConfirmed = ref(false);
const submitting = ref(false);
const noteInput = ref(null);

const statusOptions = STATUS_OPTIONS;
const currentStatusClass = computed(() => STATUS_STYLES[props.status] || STATUS_STYLES.pending);
const getStatusDotColor = (s) => STATUS_DOTS[s] || 'bg-(--text-muted)';

const isDangerousStatus = computed(() => isHighRiskOrderStatus(selectedStatus.value));

const allowedTransitions = computed(() => getAllowedOrderTransitions(props.status));
const isBlockedStatus = (s) => ['fulfilled', 'delivered'].includes(s) && !props.canDeliver;
const isOutOfFlowStatus = (s) => s !== props.status && !allowedTransitions.value.includes(s);
const isStatusDisabled = (s) =>
  isBlockedStatus(s) || (isOutOfFlowStatus(s) && !canUseForceOverride.value);
const requiresForceOverride = computed(
  () => selectedStatus.value && isOutOfFlowStatus(selectedStatus.value)
);
const canUseForceOverride = computed(() => hasForceStatusPermission(props.permissions));
const forceReasonValid = computed(() => String(statusNote.value || '').trim().length > 0);
const orderedStatusOptions = computed(() => {
  const inFlow = statusOptions.filter(
    (s) => s === props.status || allowedTransitions.value.includes(s)
  );
  const outOfFlow = statusOptions.filter((s) => !inFlow.includes(s));
  return [...inFlow, ...outOfFlow];
});

const resolveTagVariant = (s) => {
  if (s === props.status) return 'default';
  if (isBlockedStatus(s) || isOutOfFlowStatus(s)) return 'warning';
  return 'success';
};

const getStatusTagText = (s) => {
  if (s === props.status) return t('order.manage.currentTag');
  if (isBlockedStatus(s)) return t('order.manage.blockedTag');
  if (isOutOfFlowStatus(s)) return t('order.manage.forceTag');
  return t('order.manage.flowTag');
};

const getStatusButtonAriaLabel = (s) => {
  const label = formatOrderStatusLabel(t, s);
  const tag = getStatusTagText(s);
  return `${label} - ${tag}`;
};

const friendlyTipKey = computed(() => {
  if (
    !props.canDeliver &&
    props.status !== 'delivered' &&
    (!selectedStatus.value ||
      selectedStatus.value === props.status ||
      ['fulfilled', 'delivered'].includes(selectedStatus.value))
  ) {
    return 'order.manage.deliveryBlockedTip';
  }
  if (!selectedStatus.value || selectedStatus.value === props.status) {
    return 'order.manage.friendlyPickTip';
  }
  if (requiresForceOverride.value) {
    if (!canUseForceOverride.value) return 'order.manage.friendlyNoPermissionTip';
    if (!forceOverrideConfirmed.value) return 'order.manage.friendlyForceConfirmTip';
    if (!forceReasonValid.value) return 'order.manage.friendlyForceReasonTip';
    return 'order.manage.friendlyForceReadyTip';
  }
  if (isHighRiskOrderStatus(selectedStatus.value)) {
    return 'order.manage.friendlyRiskTip';
  }
  return 'order.manage.friendlyFlowTip';
});

const canConfirm = computed(() => {
  if (!selectedStatus.value || selectedStatus.value === props.status || submitting.value) {
    return false;
  }
  if (!requiresForceOverride.value) return true;
  if (!canUseForceOverride.value) return false;
  if (!forceOverrideConfirmed.value) return false;
  return forceReasonValid.value;
});

const openModal = () => {
  if (props.loading) return;
  selectedStatus.value = props.status;
  statusNote.value = '';
  forceOverrideConfirmed.value = false;
  showModal.value = true;
};

const closeModal = () => {
  if (submitting.value) return;
  showModal.value = false;
};

const handleConfirm = async () => {
  if (!canConfirm.value) return;

  submitting.value = true;
  try {
    const payload = {
      status: selectedStatus.value,
      note: statusNote.value,
      force: requiresForceOverride.value && forceOverrideConfirmed.value,
    };

    if (props.onStatusChange) {
      await props.onStatusChange(payload);
    } else {
      emit('change', payload);
    }
    showModal.value = false;
  } finally {
    submitting.value = false;
  }
};

watch(showModal, (val) => {
  if (val) {
    nextTick(() => noteInput.value?.focus?.());
  }
});
</script>
