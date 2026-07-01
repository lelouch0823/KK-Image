<template>
  <Modal
    :model-value="modelValue"
    :title="t('product.import.title')"
    @update:model-value="$emit('update:modelValue', $event)"
  >
    <div data-testid="product-import-modal" class="space-y-6">
      <div class="rounded-xl border border-(--border-color) bg-(--bg-card) p-4">
        <div class="mb-3 flex items-center justify-between">
          <h3 class="text-sm font-semibold text-(--text-main)">
            {{ t('product.import.workflow_title', '导入流程') }}
          </h3>
          <span class="text-xs text-(--text-secondary)">{{
            t(
              'product.import.workflow_step',
              { current: currentStepIndex, total: WORKFLOW_STEPS.length },
              '步骤 {current}/{total}'
            )
          }}</span>
        </div>
        <div class="relative mb-3 grid grid-cols-4 gap-2">
          <div class="absolute top-4 right-0 left-0 h-px bg-(--border-color)"></div>
          <div
            v-for="step in WORKFLOW_STEPS"
            :key="step.id"
            class="relative z-10 flex flex-col items-center gap-1"
          >
            <div
              class="flex size-8 items-center justify-center rounded-full border text-xs font-semibold transition-colors"
              :class="getWorkflowStepClass(step.order)"
            >
              <AppIcon v-if="isWorkflowCompleted(step.order)" name="check" class="size-4" />
              <span v-else>{{ step.order }}</span>
            </div>
            <span
              class="text-center text-xs leading-4"
              :class="
                isWorkflowActive(step.order)
                  ? 'text-primary font-semibold'
                  : 'text-(--text-secondary)'
              "
            >
              {{ step.label }}
            </span>
          </div>
        </div>
        <p class="text-xs text-(--text-secondary)">{{ currentWorkflowHint }}</p>
      </div>

      <!-- Step 1 & 2: Upload -->
      <ImportUploadStep v-if="currentStep === 1" @file-selected="processFile" />

      <!-- Step 3: Mapping -->
      <ImportMappingStep
        v-if="currentStep === 3"
        v-model="fieldMapping"
        v-model:spec-configs="specConfigs"
        v-model:import-mode="importMode"
        :file-headers="fileHeaders"
        :system-fields="SYSTEM_FIELDS"
        :validation-report="mappingValidationReport"
      />

      <!-- Step 5: Image Match -->
      <ImportImageMatchStep
        v-if="currentStep === 5"
        :parsed-items="parsedItems"
        :image-matches="imageMatches"
        :processed-images-count="processedImagesCount"
        :total-images-count="totalImagesCount"
        :file-count="imageUploadFiles.length"
        @files-selected="handleImageFiles"
      />

      <!-- Step 4: Preview & Result -->
      <ImportPreviewStep
        v-if="currentStep === 4"
        :file-name="fileName"
        :file-size="fileSize"
        :parsed-items="parsedItems"
        :preprocess-stats="preprocessStats"
        :loading="loading"
        :import-result="importResult"
        :import-error="importError"
        :import-stats="importStats"
        :chunk-size="CHUNK_SIZE"
        @reset="resetFile"
      />
    </div>

    <!-- Footer Actions -->
    <template #footer>
      <AppButton
        variant="ghost"
        data-testid="product-import-close"
        class="mr-2"
        :disabled="loading"
        @click="currentStep === 1 ? $emit('update:modelValue', false) : handleBack()"
      >
        {{ currentStep === 1 ? t('common.cancel') : t('product.import.back') }}
      </AppButton>

      <AppButton
        v-if="currentStep === 3"
        data-testid="product-import-confirm-mapping"
        @click="handleConfirmMapping"
      >
        {{ t('product.import.confirm_mapping') }}
      </AppButton>

      <AppButton
        v-if="currentStep === 5"
        data-testid="product-import-upload-next"
        :disabled="loading"
        :loading="loading"
        :loading-text="t('product.import.uploading')"
        @click="handleUploadImagesAndNext"
      >
        {{ t('product.import.upload_and_continue') }}
      </AppButton>

      <AppButton
        v-if="currentStep === 4"
        data-testid="product-import-submit"
        :disabled="!parsedItems.length || loading"
        :loading="loading"
        :loading-text="
          t('product.import.importing', {
            current: importStats.processed,
            total: importStats.total,
          })
        "
        @click="
          importResult && importResult.success ? $emit('update:modelValue', false) : handleImport()
        "
      >
        {{
          importResult
            ? importResult.success
              ? t('common.complete')
              : t('common.retry')
            : t('product.import.action')
        }}
      </AppButton>
    </template>
  </Modal>
  <ConfirmDialog
    v-model="confirmData.show"
    :title="confirmData.title"
    :message="confirmData.message"
    :type="confirmData.type"
    :loading="confirmData.loading"
    @confirm="confirmData.onConfirm"
  />
</template>

<script setup>
import { ref } from 'vue';
import { useI18n } from '@/composables/useI18n';
import { useProducts } from '@/composables/useProducts';
import { useToast } from '@/composables/useToast';
import Modal from '@/components/ui/Modal.vue';
import AppButton from '@/components/ui/AppButton.vue';
import AppIcon from '@/components/ui/AppIcon.vue';
import ConfirmDialog from '@/components/ui/ConfirmDialog.vue';

// Step Components
import ImportUploadStep from '@/components/product/import/ImportUploadStep.vue';
import ImportMappingStep from '@/components/product/import/ImportMappingStep.vue';
import ImportImageMatchStep from '@/components/product/import/ImportImageMatchStep.vue';
import ImportPreviewStep from '@/components/product/import/ImportPreviewStep.vue';

// Composables
import { useImportWorkflow } from '@/composables/product-import/useImportWorkflow';
import { useImportParsing } from '@/composables/product-import/useImportParsing';
import { useImportImageMatch } from '@/composables/product-import/useImportImageMatch';
import { useImportExecution } from '@/composables/product-import/useImportExecution';

const props = defineProps({
  modelValue: {
    type: Boolean,
    default: false,
  },
});
const emit = defineEmits(['update:modelValue', 'success']);

const { t } = useI18n();
const { addToast } = useToast();
const { importProducts } = useProducts();

const confirmData = ref({
  show: false,
  title: '',
  message: '',
  type: 'warning',
  loading: false,
  onConfirm: () => {},
});

// --- Composables ---
const resetAll = () => {
  resetParsing();
  resetImageMatch();
  resetExecution();
};

const workflow = useImportWorkflow(() => props.modelValue, { t, resetCallback: resetAll });

// Destructure workflow for template access
const {
  currentStep,
  WORKFLOW_STEPS,
  currentStepIndex,
  isWorkflowCompleted,
  isWorkflowActive,
  getWorkflowStepClass,
  currentWorkflowHint,
} = workflow;

const {
  fileName,
  fileSize,
  fileHeaders,
  rawFileRows,
  fieldMapping,
  specConfigs,
  importMode,
  parsedItems,
  preprocessStats,
  mappingValidationReport,
  SYSTEM_FIELDS,
  processFile,
  handleConfirmMapping: _handleConfirmMapping,
  resetParsing,
} = useImportParsing({ t, addToast, workflow });

const {
  imageUploadFiles,
  imageMatches,
  handleImageFiles,
  processedImagesCount,
  totalImagesCount,
  handleUploadImagesAndNext: _handleUploadImagesAndNext,
  resetImageMatch,
} = useImportImageMatch({ t, addToast, parsedItems, workflow });

const {
  loading,
  importError,
  importResult,
  importStats,
  CHUNK_SIZE,
  handleImport: _handleImport,
  resetExecution,
} = useImportExecution({ t, addToast, parsedItems, importMode, workflow, emit });

// --- Wrapped handlers ---
const handleConfirmMapping = () => _handleConfirmMapping();

const handleUploadImagesAndNext = async () => {
  loading.value = true;
  try {
    await _handleUploadImagesAndNext({ confirmData });
  } finally {
    loading.value = false;
  }
};

const handleImport = () => _handleImport({ importProducts });

const handleBack = () => {
  const needsReset = workflow.handleBack({
    hasImageWorkflowState: imageUploadFiles.value.length > 0 || imageMatches.value.size > 0,
  });
  if (needsReset) resetAll();
};

const resetFile = () => {
  resetAll();
  currentStep.value = 1;
};

</script>
