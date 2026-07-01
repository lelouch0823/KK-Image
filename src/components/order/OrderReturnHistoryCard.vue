<template>
  <section class="rounded-2xl border border-(--border-color) bg-(--bg-card) p-4">
    <div class="flex items-center gap-2">
      <AppIcon name="arrow-uturn-left" class="size-4 text-success" />
      <h3 class="text-sm font-semibold text-(--text-main)">
        {{ t('order.detail.returnHistoryTitle', 'Return History') }}
      </h3>
    </div>

    <div v-if="entries.length === 0" class="mt-3 text-sm text-(--text-secondary)">
      {{ t('order.detail.returnHistoryEmpty', 'No return records yet.') }}
    </div>

    <div v-else class="mt-3 space-y-3">
      <article
        v-for="entry in entries"
        :key="entry.id"
        class="rounded-2xl border border-(--border-color) bg-(--bg-muted)/55 p-3"
      >
        <div class="flex items-start justify-between gap-3">
          <div class="min-w-0">
            <p class="text-sm font-medium text-(--text-main)">
              {{ entry.lineLabel || t('order.detail.lineItems', 'Order Lines') }}
              <span class="text-(--text-secondary)"> · {{ reasonLabel(entry.reason) }} </span>
            </p>
            <p class="mt-1 text-xs text-(--text-secondary)">
              {{
                t('order.detail.returnHistoryMeta', '{quantity} units · {status}', {
                  quantity: entry.quantity,
                  status: statusLabel(entry.status),
                })
              }}
            </p>
          </div>
          <p class="shrink-0 text-xs text-(--text-secondary)">
            {{ formatTimelineTime(entry.createdAt) }}
          </p>
        </div>

        <p class="mt-2 text-xs text-(--text-secondary)">
          {{ entry.createdBy || t('sidebar.admin', 'Admin') }}
        </p>

        <p v-if="entry.note" class="mt-2 text-sm whitespace-pre-wrap text-(--text-main)">
          {{ entry.note }}
        </p>
      </article>
    </div>
  </section>
</template>

<script setup>
import { computed } from 'vue';
import { useI18n } from '@/composables/useI18n';
import { formatReadableLabel } from '@/utils/event-display';
import { formatTimelineTime } from '@/utils/formatters';
import AppIcon from '@/components/ui/AppIcon.vue';

const props = defineProps({
  returns: {
    type: Array,
    default: () => [],
  },
});

const { t } = useI18n();

const entries = computed(() => (Array.isArray(props.returns) ? props.returns : []));

function reasonLabel(reason) {
  return t(`order.returnReasons.${reason}`, reason ? formatReadableLabel(reason) : t('order.returnReasons.other'));
}

function statusLabel(status) {
  return t(`order.detail.returnStatuses.${status}`, formatReadableLabel(status));
}
</script>
