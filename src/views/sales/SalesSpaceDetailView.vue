<template>
  <div class="flex min-h-full flex-col">
    <div v-if="loading" class="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      <div class="mb-8 space-y-4">
        <Skeleton type="text" width="w-64" class="h-8" />
        <Skeleton type="text" width="w-80" class="h-4" />
      </div>
      <div class="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        <Skeleton v-for="i in 8" :key="i" type="custom" custom-class="aspect-square w-full rounded-xl" />
      </div>
    </div>

    <div v-else-if="error" class="flex min-h-[50vh] items-center justify-center px-4">
      <EmptyState
        icon="search"
        :title="t('spacePublic.cannotLoad')"
        :description="error"
      />
    </div>

    <component
      v-else-if="space"
      :is="spaceComponent"
      :space="space"
      :get-subspace-href="getSubspaceHref"
    />
  </div>
</template>

<script setup>
import { computed, defineAsyncComponent, inject, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import { useI18n } from '@/composables/useI18n';
import { useRequestAdapters } from '@/composables/useRequestAdapters';
import { API } from '@/utils/constants';
import { normalizeSalesSpace } from '@/utils/sales-space';
import Skeleton from '@/components/ui/Skeleton.vue';
import EmptyState from '@/components/ui/EmptyState.vue';

const SpaceMasonry = defineAsyncComponent(() => import('@/components/space/SpaceMasonry.vue'));
const SpaceProductDetail = defineAsyncComponent(
  () => import('@/components/space/SpaceProductDetail.vue')
);
const SpaceCollection = defineAsyncComponent(
  () => import('@/components/space/SpaceCollection.vue')
);
const SpaceDocument = defineAsyncComponent(() => import('@/components/space/SpaceMasonry.vue'));

const { t } = useI18n();
const { requestSales } = useRequestAdapters();
const route = useRoute();
const salesContext = inject('salesContext', null);

const loading = ref(true);
const error = ref('');
const space = ref(null);
let detailRequestId = 0;

const currentToken = computed(() => salesContext?.accessToken?.value || String(route.params.token || ''));
const currentSpaceId = computed(() => String(route.params.id || ''));
const isActiveDetailRequest = (requestId, requestToken, requestSpaceId) => (
  requestId === detailRequestId &&
  currentToken.value === requestToken &&
  currentSpaceId.value === requestSpaceId
);

const spaceComponent = computed(() => {
  switch (space.value?.template) {
    case 'product':
      return SpaceProductDetail;
    case 'collection':
      return SpaceCollection;
    case 'document':
      return SpaceDocument;
    default:
      return SpaceMasonry;
  }
});

const getSubspaceHref = (subspace) => `/sales/${currentToken.value}/spaces/${subspace.id}`;

const loadSpaceDetail = async () => {
  const requestToken = currentToken.value;
  const requestSpaceId = currentSpaceId.value;
  const requestId = ++detailRequestId;

  if (!requestToken || !requestSpaceId) {
    error.value = t('spacePublic.invalidLink');
    loading.value = false;
    space.value = null;
    return false;
  }

  loading.value = true;
  error.value = '';

  try {
    const response = await requestSales(API.SALES_SPACE_DETAIL(requestToken, requestSpaceId), {
      token: requestToken,
    });
    const result = await response.json();
    if (!isActiveDetailRequest(requestId, requestToken, requestSpaceId)) return false;

    if (result.success && result.data) {
      space.value = normalizeSalesSpace(result.data);
      return true;
    }

    space.value = null;
    error.value = result.error || result.message || t('spacePublic.loadFailed');
  } catch (_error) {
    if (!isActiveDetailRequest(requestId, requestToken, requestSpaceId)) return false;
    space.value = null;
    error.value = t('common.networkErrorRetry');
  } finally {
    if (isActiveDetailRequest(requestId, requestToken, requestSpaceId)) {
      loading.value = false;
    }
  }

  return false;
};

watch([currentToken, currentSpaceId], () => {
  loadSpaceDetail();
}, { immediate: true });
</script>
