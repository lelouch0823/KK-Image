<template>
  <div
    class="fixed inset-0 z-50 flex items-end justify-center bg-black/50 lg:items-center"
    @click.self="$emit('close')"
  >
    <!-- 移动端: 全屏底部抽屉 | 桌面端: 居中弹窗 -->
    <div
      class="flex size-full flex-col overflow-hidden rounded-t-2xl bg-white lg:mx-4 lg:h-[90vh] lg:max-w-5xl lg:flex-row lg:rounded-2xl lg:rounded-t-2xl"
    >
      <!-- 移动端: 顶部标签栏 -->
      <div class="flex items-center border-b border-[var(--border-color)] px-4 py-3 lg:hidden">
        <button
          class="flex-1 border-b-2 py-2 text-center text-sm font-medium transition-colors"
          :class="
            mobileTab === 'info'
              ? 'border-primary text-primary'
              : 'text-secondary border-transparent'
          "
          @click="mobileTab = 'info'"
        >
          {{ t('spaceManager.productInfo') }}
        </button>
        <button
          class="flex-1 border-b-2 py-2 text-center text-sm font-medium transition-colors"
          :class="
            mobileTab === 'media'
              ? 'border-primary text-primary'
              : 'text-secondary border-transparent'
          "
          @click="mobileTab = 'media'"
        >
          {{ t('spaceManager.media') }}
        </button>
        <button class="text-muted ml-2 p-2 hover:text-primary" @click="$emit('close')">
          <svg class="size-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      </div>

      <!-- 左侧：商品属性编辑器 -->
      <div
        v-show="mobileTab === 'info' || isDesktop"
        class="flex flex-1 flex-col border-r border-[var(--border-color)] bg-[var(--bg-muted)] lg:w-1/3"
        :class="{ hidden: mobileTab !== 'info' }"
      >
        <!-- 桌面端标题 -->
        <div
          class="hidden items-center justify-between border-b border-[var(--border-color)] px-6 py-4 lg:flex"
        >
          <div>
            <div class="flex items-center gap-2">
              <h2 class="text-primary text-lg font-semibold">
                {{ t('spaceManager.productInfo') }}
              </h2>
              <span
                v-if="form.isPublic"
                class="rounded-full bg-[var(--color-success-bg)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--color-success)]"
                >🌐 {{ t('spaceManager.publicOn') }}</span
              >
              <span
                v-else
                class="text-secondary rounded-full bg-[var(--bg-muted)] px-1.5 py-0.5 text-[10px] font-medium"
                >🔒 {{ t('spaceManager.publicOff') }}</span
              >
            </div>
            <p class="text-secondary mt-1 text-xs">{{ t('spaceManager.editParams') }}</p>
          </div>
        </div>

        <!-- 表单区域 -->
        <div class="flex-1 space-y-4 overflow-y-auto p-6">
          <div>
            <label class="text-primary mb-1 block text-sm font-medium">{{
              t('spaceManager.productName')
            }}</label>
            <input
              v-model="form.name"
              type="text"
              class="focus:border-primary w-full rounded-lg border border-[var(--border-color)] px-4 py-2 transition-colors outline-none"
            />
          </div>

          <div>
            <label class="text-primary mb-1 block text-sm font-medium">{{
              t('spaceManager.brand')
            }}</label>
            <input
              v-model="form.templateData.brand"
              type="text"
              class="focus:border-primary w-full rounded-lg border border-[var(--border-color)] px-4 py-2 transition-colors outline-none"
            />
          </div>

          <div>
            <label class="text-primary mb-1 block text-sm font-medium">{{
              t('spaceManager.series')
            }}</label>
            <input
              v-model="form.templateData.series"
              type="text"
              class="focus:border-primary w-full rounded-lg border border-[var(--border-color)] px-4 py-2 transition-colors outline-none"
            />
          </div>

          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="text-primary mb-1 block text-sm font-medium">{{
                t('spaceManager.price')
              }}</label>
              <input
                v-model="form.templateData.price"
                type="number"
                class="focus:border-primary w-full rounded-lg border border-[var(--border-color)] px-4 py-2 transition-colors outline-none"
              />
            </div>
            <div>
              <label class="text-primary mb-1 block text-sm font-medium">{{
                t('spaceManager.material')
              }}</label>
              <input
                v-model="form.templateData.material"
                type="text"
                class="focus:border-primary w-full rounded-lg border border-[var(--border-color)] px-4 py-2 transition-colors outline-none"
              />
            </div>
          </div>

          <div>
            <label class="text-primary mb-1 block text-sm font-medium">SKU</label>
            <input
              v-model="form.templateData.sku"
              type="text"
              :placeholder="t('spaceManager.skuPlaceholder')"
              class="focus:border-primary w-full rounded-lg border border-[var(--border-color)] px-4 py-2 transition-colors outline-none"
            />
          </div>

          <div>
            <label class="text-primary mb-1 block text-sm font-medium">{{
              t('spaceManager.descLabel')
            }}</label>
            <textarea
              v-model="form.description"
              rows="4"
              class="focus:border-primary w-full resize-none rounded-lg border border-[var(--border-color)] px-4 py-2 transition-colors outline-none"
            ></textarea>
          </div>

          <!-- Share Card -->
          <div class="border-t border-[var(--border-color)] pt-4">
            <SpaceShareCard
              v-model:is-public="form.isPublic"
              v-model:password-enabled="passwordEnabled"
              v-model:password="form.password"
              :share-url="shareUrl"
            />
          </div>
        </div>

        <!-- 底部操作栏 -->
        <div class="flex gap-3 border-t border-[var(--border-color)] px-6 py-4">
          <button
            class="text-secondary flex items-center gap-1.5 rounded-lg border border-[var(--border-color)] px-4 py-2 transition-colors hover:text-primary"
            @click="openPreview"
          >
            <svg class="size-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
              />
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
              />
            </svg>
            {{ t('spaceManager.preview') }}
          </button>
          <button
            :disabled="saving"
            class="bg-primary flex-1 rounded-lg py-2 text-white transition-colors hover:bg-[var(--color-primary-hover)] disabled:opacity-50"
            @click="saveChanges"
          >
            {{ saving ? t('spaceManager.saving') : t('spaceManager.save') }}
          </button>
        </div>
      </div>

      <!-- 右侧：媒体资源管理 + 数据分析 -->
      <div
        v-show="mobileTab === 'media' || isDesktop"
        class="flex flex-1 flex-col bg-white"
        :class="{ 'hidden lg:flex': mobileTab !== 'media' }"
      >
        <!-- 右侧标签头 (桌面端) -->
        <div
          class="hidden items-center justify-between border-b border-[var(--border-color)] px-6 py-3 lg:flex"
        >
          <div class="flex space-x-4">
            <button
              class="border-b-2 px-1 py-2 text-sm font-medium transition-colors duration-200"
              :class="
                activeRightTab === 'media'
                  ? 'border-primary text-primary'
                  : 'text-secondary border-transparent hover:text-[var(--text-main)]'
              "
              @click="activeRightTab = 'media'"
            >
              {{ t('spaceManager.media') }}
            </button>
            <button
              class="border-b-2 px-1 py-2 text-sm font-medium transition-colors duration-200"
              :class="
                activeRightTab === 'analytics'
                  ? 'border-primary text-primary'
                  : 'text-secondary border-transparent hover:text-[var(--text-main)]'
              "
              @click="activeRightTab = 'analytics'"
            >
              {{ t('spaceManager.tabs.analytics') }}
            </button>
          </div>
          <div class="flex gap-2">
            <Tooltip v-if="activeRightTab === 'media'" :content="t('spaceManager.addFile')">
              <button
                class="text-primary flex size-8 items-center justify-center rounded-lg bg-[var(--bg-muted)] text-sm font-medium transition-colors hover:bg-[var(--bg-hover)]"
                @click="showFileSelector = true"
              >
                <svg class="size-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M12 4v16m8-8H4"
                  />
                </svg>
              </button>
            </Tooltip>
            <button
              class="text-secondary rounded-lg p-2 hover:text-primary hover:bg-[var(--bg-hover)]"
              @click="$emit('close')"
            >
              <svg class="size-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>
        </div>

        <!-- 移动端顶部操作栏 -->
        <div
          class="flex items-center justify-between border-b border-[var(--border-color)] px-4 py-3 lg:hidden"
        >
          <span class="text-primary text-sm font-medium">{{ t('spaceManager.media') }}</span>
          <button
            class="bg-primary flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs text-white"
            @click="showFileSelector = true"
          >
            <svg class="size-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M12 4v16m8-8H4"
              />
            </svg>
            {{ t('spaceManager.addFile') }}
          </button>
        </div>

        <!-- 媒体标签内容 -->
        <div
          v-show="activeRightTab === 'media' || !isDesktop"
          class="flex-1 overflow-y-auto p-4 lg:p-6"
        >
          <SpaceMediaGrid
            :files="files"
            :cover-file-id="form.coverFileId"
            @set-cover="setCover"
            @remove="removeFile"
            @add-files="showFileSelector = true"
          />
        </div>

        <!-- 数据分析标签内容 -->
        <div v-show="activeRightTab === 'analytics'" class="flex-1 overflow-y-auto p-6">
          <SpaceAnalytics :space-id="space.id" />
        </div>
      </div>
    </div>

    <FileSelector v-if="showFileSelector" @close="showFileSelector = false" @select="addFiles" />

    <!-- Confirm Dialog -->
    <ConfirmDialog
      v-model="confirmData.show"
      :title="confirmData.title"
      :message="confirmData.message"
      :type="confirmData.type"
      :loading="confirmData.loading"
      @confirm="confirmData.onConfirm"
    />
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue';
import { useSpaces } from '@/composables/useSpaces';
import { useToast } from '@/composables/useToast';
import { useI18n } from '@/composables/useI18n';
import { ROUTES } from '@/utils/constants';

// Components
import FileSelector from '@/components/FileSelector.vue';
import Tooltip from '@/components/ui/Tooltip.vue';
import SpaceAnalytics from './SpaceAnalytics.vue';
import SpaceShareCard from './space/SpaceShareCard.vue';
import SpaceMediaGrid from './space/SpaceMediaGrid.vue';
import ConfirmDialog from '@/components/ui/ConfirmDialog.vue';

const props = defineProps({
  space: { type: Object, required: true },
});

const emit = defineEmits(['close', 'updated']);

const { updateSpace, addFilesToSpace, removeFilesFromSpace, loadSpace } = useSpaces();
const { addToast } = useToast();
const { t } = useI18n();

const showFileSelector = ref(false);
const saving = ref(false);
const files = ref([]);
const activeRightTab = ref('media');
const passwordEnabled = ref(false);
const mobileTab = ref('info');
const isDesktop = ref(window.innerWidth >= 1024);

// 确认弹窗状态
const confirmData = ref({
  show: false,
  title: '',
  message: '',
  type: 'primary',
  loading: false,
  onConfirm: () => {},
});

const form = ref({
  name: '',
  description: '',
  isPublic: false,
  coverFileId: null,
  password: '',
  templateData: {
    brand: '',
    series: '',
    price: '',
    material: '',
    sku: '',
  },
});

const shareUrl = computed(() => {
  if (!props.space.shareToken) return t('spaceManager.saveToGenerate');
  return `${window.location.origin}${ROUTES.SPACE(props.space.shareToken)}`;
});

const initData = async () => {
  const data = await loadSpace(props.space.id);
  if (data) {
    form.value = {
      name: data.name || '',
      description: data.description || '',
      isPublic: data.isPublic || false,
      coverFileId: data.coverFileId || null,
      password: data.password || '',
      templateData: {
        brand: data.templateData?.brand || '',
        series: data.templateData?.series || '',
        price: data.templateData?.price || '',
        material: data.templateData?.material || '',
        sku: data.templateData?.sku || '',
      },
    };
    files.value = data.files || [];
    passwordEnabled.value = !!data.password;
  }
};

const saveChanges = async () => {
  saving.value = true;
  try {
    const success = await updateSpace(props.space.id, {
      ...form.value,
      password: passwordEnabled.value ? form.value.password : null,
    });
    if (success) {
      emit('updated');
    }
  } finally {
    saving.value = false;
  }
};

const openPreview = () => {
  if (props.space.shareToken) {
    window.open(ROUTES.SPACE(props.space.shareToken), '_blank');
  } else {
    addToast({ message: t('spaceManager.saveFirst'), type: 'warning' });
  }
};

const addFiles = async (fileIds) => {
  showFileSelector.value = false;
  await addFilesToSpace(props.space.id, fileIds);
  await initData();
  emit('updated');
};

const removeFile = (fileId) => {
  confirmData.value = {
    show: true,
    title: t('common.confirm'),
    message: t('spaceManager.removeFileConfirm'),
    type: 'danger',
    loading: false,
    onConfirm: async () => {
      confirmData.value.loading = true;
      try {
        await removeFilesFromSpace(props.space.id, [fileId]);
        await initData();
        emit('updated');
        confirmData.value.show = false;
      } finally {
        confirmData.value.loading = false;
      }
    },
  };
};

const setCover = (file) => {
  form.value.coverFileId = file.id;
  addToast({ message: t('spaceManager.coverSet'), type: 'success' });
};

onMounted(initData);
</script>
