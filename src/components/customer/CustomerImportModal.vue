<template>
  <Modal
    :model-value="modelValue"
    :title="t('customer.import.title')"
    size="3xl"
    @update:model-value="$emit('update:modelValue', $event)"
  >
    <div class="space-y-5">
      <!-- Step 1: 上传区域 -->
      <div v-if="step === 1" class="space-y-4">
        <div
          class="relative flex min-h-[280px] cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-10 transition-colors"
          :class="isDragOver ? 'border-primary bg-primary/10' : 'border-(--border-color) bg-(--bg-muted) hover:bg-(--bg-hover)'"
          @dragover.prevent="isDragOver = true"
          @dragleave.prevent="isDragOver = false"
          @drop.prevent="handleDrop"
          @click="fileInputRef.click()"
        >
          <input
            ref="fileInputRef"
            type="file"
            accept=".xlsx,.xls,.csv"
            class="hidden"
            @change="handleFileSelect"
          >
          <div class="text-center">
            <div class="bg-primary/10 mx-auto mb-3 flex size-14 items-center justify-center rounded-full">
              <AppIcon name="cloud-arrow-up" class="text-primary size-7" />
            </div>
            <p class="text-sm font-medium text-(--text-main)">
              <span class="text-primary">{{ t('common.click_to_upload', '点击上传') }}</span>
              {{ t('common.or_drag_drop', '或拖拽文件到此处') }}
            </p>
            <p class="mt-1 text-xs text-(--text-secondary)">
              {{ t('customer.import.fileFormats') }}
            </p>
          </div>
        </div>

        <!-- 解析错误 -->
        <div v-if="parseError" class="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {{ parseError }}
        </div>
      </div>

      <!-- Step 2: 预览 -->
      <div v-if="step === 2" class="space-y-4">
        <!-- 统计信息 -->
        <div class="flex items-center gap-4 text-sm">
          <span class="flex items-center gap-1 text-green-600">
            <AppIcon name="check-circle" class="size-4" />
            {{ t('customer.import.valid') }}: {{ validRows.length }}
          </span>
          <span v-if="rowsWithErrors.length > 0" class="flex items-center gap-1 text-red-600">
            <AppIcon name="exclamation-circle" class="size-4" />
            {{ t('customer.import.errors') }}: {{ rowsWithErrors.length }}
          </span>
          <span class="text-(--text-secondary)">
            {{ t('customer.import.previewDesc', { count: Math.min(previewRows.length, 10), total: parsedRows.length }) }}
          </span>
        </div>

        <!-- 预览表格 -->
        <div class="overflow-x-auto rounded-lg border border-(--border-color)">
          <table class="w-full text-sm">
            <thead>
              <tr class="border-b border-(--border-color) bg-(--bg-muted)">
                <th class="px-3 py-2 text-left text-xs font-medium text-(--text-secondary)">#</th>
                <th class="px-3 py-2 text-left text-xs font-medium text-(--text-secondary)">{{ t('customer.form.name') }}</th>
                <th class="px-3 py-2 text-left text-xs font-medium text-(--text-secondary)">{{ t('customer.form.phone') }}</th>
                <th class="px-3 py-2 text-left text-xs font-medium text-(--text-secondary)">{{ t('customer.form.company') }}</th>
                <th class="px-3 py-2 text-left text-xs font-medium text-(--text-secondary)">{{ t('customer.form.email') }}</th>
                <th class="px-3 py-2 text-left text-xs font-medium text-(--text-secondary)">{{ t('customer.form.tags') }}</th>
                <th class="px-3 py-2 text-left text-xs font-medium text-(--text-secondary)">{{ t('customer.import.errors') }}</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="(row, idx) in previewRows"
                :key="idx"
                class="border-b border-(--border-color) last:border-0"
                :class="{ 'bg-red-50/50': row._errors && row._errors.length > 0 }"
              >
                <td class="px-3 py-2 text-(--text-muted)">{{ idx + 1 }}</td>
                <td class="px-3 py-2 font-medium text-(--text-main)">{{ row.name || '-' }}</td>
                <td class="px-3 py-2 text-(--text-secondary)">{{ row.phone || '-' }}</td>
                <td class="px-3 py-2 text-(--text-secondary)">{{ row.company || '-' }}</td>
                <td class="px-3 py-2 text-(--text-secondary)">{{ row.email || '-' }}</td>
                <td class="px-3 py-2">
                  <div class="flex flex-wrap gap-1">
                    <span
                      v-for="tag in (row.tags || [])"
                      :key="tag"
                      class="rounded bg-(--bg-muted) px-1.5 py-0.5 text-[10px] text-(--text-secondary)"
                    >
                      {{ tag }}
                    </span>
                    <span v-if="!row.tags || row.tags.length === 0" class="text-(--text-muted)">-</span>
                  </div>
                </td>
                <td class="px-3 py-2">
                  <div v-if="row._errors && row._errors.length > 0" class="space-y-0.5">
                    <p v-for="err in row._errors" :key="err" class="text-xs text-red-600">
                      {{ err }}
                    </p>
                  </div>
                  <span v-else class="text-xs text-green-600">OK</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- 导入结果 -->
      <div v-if="importResult" class="rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-800">
        <p class="font-medium">{{ t('customer.import.success', { imported: importResult.imported }) }}{{ importResult.skipped > 0 ? t('customer.import.skipped', { count: importResult.skipped }) : '' }}</p>
      </div>
    </div>

    <template #footer>
      <AppButton
        variant="ghost"
        class="mr-2"
        :disabled="importing"
        @click="handleCancel"
      >
        {{ step === 2 && !importResult ? t('common.back', '返回') : t('common.cancel') }}
      </AppButton>

      <AppButton
        v-if="step === 2 && !importResult"
        variant="primary"
        :disabled="validRows.length === 0 || importing"
        @click="handleConfirmImport"
      >
        <template #icon-left>
          <AppIcon
            v-if="importing"
            name="spinner"
            class="size-4 animate-spin"
          />
        </template>
        {{ importing ? t('customer.import.importing') : t('customer.import.confirmImport') + ` (${validRows.length})` }}
      </AppButton>
    </template>
  </Modal>
</template>

<script setup>
import { ref, computed } from 'vue';
import { useI18n } from '@/composables/useI18n';
import { useToast } from '@/composables/useToast';
import { useAuth } from '@/composables/useAuth';
import { API } from '@/utils/constants';
import Modal from '@/components/ui/Modal.vue';
import AppButton from '@/components/ui/AppButton.vue';
import AppIcon from '@/components/ui/AppIcon.vue';

const props = defineProps({
  modelValue: { type: Boolean, default: false },
});
const emit = defineEmits(['update:modelValue', 'imported']);

const { t } = useI18n();
const { addToast } = useToast();
const { authFetch } = useAuth();

const step = ref(1);
const isDragOver = ref(false);
const fileInputRef = ref(null);
const parseError = ref('');
const parsedRows = ref([]);
const importing = ref(false);
const importResult = ref(null);

// --- XLSX 动态加载 ---
let _xlsx = null;
async function getXLSX() {
  if (!_xlsx) _xlsx = await import('xlsx');
  return _xlsx;
}

// --- 计算属性 ---
const previewRows = computed(() => parsedRows.value.slice(0, 10));

const validRows = computed(() =>
  parsedRows.value.filter((row) => !row._errors || row._errors.length === 0)
);

const rowsWithErrors = computed(() =>
  parsedRows.value.filter((row) => row._errors && row._errors.length > 0)
);

// --- 文件解析 ---
const parseFile = async (file) => {
  if (!file) return;
  parseError.value = '';
  parsedRows.value = [];
  importResult.value = null;

  if (!/\.(xlsx|xls|csv)$/i.test(file.name)) {
    parseError.value = t('customer.import.fileFormats');
    return;
  }

  try {
    const XLSX = await getXLSX();
    const data = await file.arrayBuffer();
    const workbook = XLSX.read(data);
    const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
    const jsonData = XLSX.utils.sheet_to_json(firstSheet, { header: 1, defval: '' });

    if (jsonData.length < 2) {
      parseError.value = t('customer.import.noValidRows');
      return;
    }

    // 查找列映射（自动匹配表头）
    const headers = jsonData[0].map((h) => String(h).trim().toLowerCase());
    const nameIdx = headers.findIndex((h) => h.includes('名称') || h.includes('name') || h === '客户');
    const phoneIdx = headers.findIndex((h) => h.includes('电话') || h.includes('phone') || h.includes('tel'));
    const companyIdx = headers.findIndex((h) => h.includes('公司') || h.includes('company') || h.includes('单位'));
    const emailIdx = headers.findIndex((h) => h.includes('邮箱') || h.includes('email'));
    const addressIdx = headers.findIndex((h) => h.includes('地址') || h.includes('address'));
    const tagsIdx = headers.findIndex((h) => h.includes('标签') || h.includes('tags') || h.includes('tag'));
    const remarkIdx = headers.findIndex((h) => h.includes('备注') || h.includes('remark') || h.includes('note'));

    // 解析数据行
    const rows = [];
    for (let i = 1; i < jsonData.length; i++) {
      const raw = jsonData[i];
      // 跳过空行
      if (!raw || raw.every((v) => v === '' || v === null || v === undefined)) continue;

      const row = {
        name: nameIdx >= 0 ? String(raw[nameIdx] || '').trim() : '',
        phone: phoneIdx >= 0 ? String(raw[phoneIdx] || '').trim() : '',
        company: companyIdx >= 0 ? String(raw[companyIdx] || '').trim() : '',
        email: emailIdx >= 0 ? String(raw[emailIdx] || '').trim() : '',
        address: addressIdx >= 0 ? String(raw[addressIdx] || '').trim() : '',
        tags: tagsIdx >= 0 ? parseTags(raw[tagsIdx]) : [],
        remark: remarkIdx >= 0 ? String(raw[remarkIdx] || '').trim() : '',
        _errors: [],
      };

      // 验证
      if (!row.name) {
        row._errors.push(t('customer.import.errorNameRequired'));
      }
      if (row.email && !isValidEmail(row.email)) {
        row._errors.push(t('customer.import.errorInvalidEmail'));
      }

      rows.push(row);
    }

    if (rows.length === 0) {
      parseError.value = t('customer.import.noValidRows');
      return;
    }

    parsedRows.value = rows;
    step.value = 2;
  } catch (e) {
    console.error('File parse error:', e);
    parseError.value = t('customer.import.fileFormats');
  }
};

const parseTags = (value) => {
  if (!value) return [];
  const str = String(value).trim();
  if (!str) return [];
  // 支持逗号、分号、中文顿号分隔
  return str.split(/[,;；、]/).map((s) => s.trim()).filter(Boolean);
};

const isValidEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

// --- 事件处理 ---
const handleFileSelect = (e) => {
  const file = e.target.files[0];
  if (file) parseFile(file);
  if (fileInputRef.value) fileInputRef.value.value = '';
};

const handleDrop = (e) => {
  isDragOver.value = false;
  const file = e.dataTransfer.files[0];
  if (file) parseFile(file);
};

const handleCancel = () => {
  if (step.value === 2 && !importResult.value) {
    step.value = 1;
    parsedRows.value = [];
    parseError.value = '';
  } else {
    emit('update:modelValue', false);
    resetState();
  }
};

const handleConfirmImport = async () => {
  if (importing.value || validRows.value.length === 0) return;
  importing.value = true;

  try {
    const payload = validRows.value.map(({ _errors, ...rest }) => rest);
    const res = await authFetch(API.MANAGE_CUSTOMER_IMPORT_CONFIRM, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rows: payload }),
    });
    const result = await res.json();

    if (result.success) {
      importResult.value = result.data;
      addToast({ message: result.message, type: 'success' });
      emit('imported');
    } else {
      addToast({ message: result.error || result.message || t('common.operationFailed'), type: 'error' });
    }
  } catch (e) {
    console.error('Import confirm error:', e);
    addToast({ message: t('common.networkError'), type: 'error' });
  } finally {
    importing.value = false;
  }
};

const resetState = () => {
  step.value = 1;
  isDragOver.value = false;
  parseError.value = '';
  parsedRows.value = [];
  importing.value = false;
  importResult.value = null;
};

// 关闭弹窗时重置状态
import { watch } from 'vue';
watch(() => props.modelValue, (visible) => {
  if (!visible) resetState();
});
</script>
