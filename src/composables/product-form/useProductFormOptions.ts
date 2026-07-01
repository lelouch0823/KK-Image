import type { Ref } from 'vue';
import type {
  ProductOption,
  DimensionArchiveWizard,
  ValueArchiveWizard,
  TrackedDimension,
} from './product-form-types';

interface CreateProductFormOptionsOptions {
  form: { options: ProductOption[]; variants: unknown[] };
  editMode: Ref<boolean>;
  initialData: Ref<Record<string, unknown> | null>;
  modelValue?: Ref<boolean> | null;
  trackedDimensions: Ref<TrackedDimension[]>;
  dimensionArchiveWizard: DimensionArchiveWizard;
  valueArchiveWizard: ValueArchiveWizard;
  addToast: (options: { type: string; message: string }) => void;
  t: (key: string, fallback?: string) => string;
  previewDimensionImpact: (productId: string, payload: Record<string, unknown>) => Promise<unknown>;
  addDimensionValue: (productId: string, dimensionId: string, payload: Record<string, unknown>) => Promise<unknown>;
  restoreDimensionValue: (productId: string, valueId: string) => Promise<unknown>;
  resolveActionErrorMessage: (error: unknown) => string;
  generateVariants: () => void;
  nextAsyncActionRequestId: (() => number) & { current: () => number };
  isAsyncActionActive: (requestId: number) => boolean;
}

/**
 * createProductFormOptions — 选项 CRUD 逻辑
 *
 * 从 useProductForm 中提取的选项维度增删改 + 选项值增删改恢复逻辑。
 */
export function createProductFormOptions({
  form,
  editMode,
  initialData,
  modelValue,
  trackedDimensions,
  dimensionArchiveWizard,
  valueArchiveWizard,
  addToast,
  t,
  previewDimensionImpact,
  addDimensionValue,
  restoreDimensionValue,
  resolveActionErrorMessage,
  generateVariants,
  nextAsyncActionRequestId,
  isAsyncActionActive,
}: CreateProductFormOptionsOptions) {
  // --- 维度值追踪辅助 ---
  const updateTrackedDimensionValue = (dimensionId: string, valueLabel: string, updater: (current: Record<string, unknown> | null) => Record<string, unknown> | null): void => {
    const trackedDimension = trackedDimensions.value.find((dimension) => dimension.id === dimensionId);
    if (!trackedDimension) return;

    if (!Array.isArray(trackedDimension.values)) trackedDimension.values = [];
    const existingIndex = trackedDimension.values.findIndex((entry) => entry?.value === valueLabel);
    const currentValue = existingIndex >= 0 ? trackedDimension.values[existingIndex] : null;
    const nextValue = updater(currentValue as Record<string, unknown> | null);
    if (!nextValue) return;

    if (existingIndex >= 0) {
      trackedDimension.values.splice(existingIndex, 1, nextValue as TrackedDimension['values'] extends (infer U)[] ? U : never);
      return;
    }

    trackedDimension.values.push(nextValue as TrackedDimension['values'] extends (infer U)[] ? U : never);
  };

  const findTrackedValueMeta = (dimensionId: string, valueLabel: string) =>
    trackedDimensions.value
      .find((dimension) => dimension.id === dimensionId)
      ?.values?.find((entry) => entry?.value === valueLabel);

  // --- 选项 CRUD ---
  const addOption = (): void => {
    if (form.options.length >= 3) {
      addToast({ message: t('common.validation_error', '最多 3 个维度'), type: 'error' });
      return;
    }
    form.options.push({ id: null, name: '', values: [], inputValue: '', archivedValues: [] });
  };

  const removeOption = async (idx: number): Promise<void> => {
    const option = form.options[idx];
    if (!option) return;
    if (editMode.value && option.id && initialData.value?.id) {
      const requestId = nextAsyncActionRequestId();
      try {
        const impact = await previewDimensionImpact(initialData.value.id as string, {
          action: 'archive_dimension',
          dimensionId: option.id,
        });
        if (!isAsyncActionActive(requestId)) return;
        dimensionArchiveWizard.open = true;
        dimensionArchiveWizard.optionIndex = idx;
        dimensionArchiveWizard.optionId = option.id;
        dimensionArchiveWizard.affectedVariantsCount = (impact as Record<string, unknown>)?.data ? ((impact as Record<string, unknown>).data as Record<string, unknown>).affectedVariantsCount as number ?? 0 : 0;
        const sampleVariants = (impact as Record<string, unknown>)?.data ? ((impact as Record<string, unknown>).data as Record<string, unknown>).sampleVariants : [];
        dimensionArchiveWizard.sampleVariants = Array.isArray(sampleVariants) ? sampleVariants : [];
        dimensionArchiveWizard.mode = 'archive_variants';
        dimensionArchiveWizard.step = 1;
      } catch (error) {
        if (!isAsyncActionActive(requestId)) return;
        addToast({ message: resolveActionErrorMessage(error), type: 'error' });
      }
      return;
    }
    form.options.splice(idx, 1);
    generateVariants();
  };

  // --- 选项值 CRUD ---
  const addOptionValue = async (opt: ProductOption, extraMeta: Record<string, unknown> | null = null): Promise<void> => {
    if (!opt.inputValue) return;
    const vals = opt.inputValue
      .split(',')
      .map((v) => v.trim())
      .filter(Boolean);

    if (!opt.metaMap) opt.metaMap = {};

    for (const v of vals) {
      if (editMode.value && opt.id && initialData.value?.id) {
        const payload: Record<string, unknown> = { value: v };
        const nextMeta = extraMeta ? { ...(opt.metaMap[v] as Record<string, unknown> || {}), ...extraMeta } : opt.metaMap[v];
        if (nextMeta) payload.meta = nextMeta;

        let response;
        try {
          response = await addDimensionValue(initialData.value.id as string, opt.id, payload);
        } catch (error) {
          if (!modelValue || modelValue.value !== false) {
            addToast({ message: resolveActionErrorMessage(error), type: 'error' });
          }
          continue;
        }
        if (!(response as Record<string, unknown>)?.success) {
          addToast({ message: ((response as Record<string, unknown>)?.error as string) || t('common.operationFailed'), type: 'error' });
          continue;
        }
        if (!opt.values.includes(v)) opt.values.push(v);
        if (extraMeta) opt.metaMap[v] = nextMeta;
        if ((response as Record<string, unknown>)?.data && ((response as Record<string, unknown>).data as Record<string, unknown>)?.id) {
          updateTrackedDimensionValue(opt.id, v, (currentValue) => ({
            ...(currentValue || {}),
            ...((response as Record<string, unknown>).data as Record<string, unknown>),
            value: (((response as Record<string, unknown>).data as Record<string, unknown>)?.value as string) || v,
            status: (((response as Record<string, unknown>).data as Record<string, unknown>)?.status as string) || 'active',
          }));
        }
        continue;
      }
      if (!opt.values.includes(v)) opt.values.push(v);
      if (extraMeta) opt.metaMap[v] = { ...(opt.metaMap[v] as Record<string, unknown> || {}), ...extraMeta };
    }
    opt.inputValue = '';
    generateVariants();
  };

  const removeOptionValue = async (opt: ProductOption, vIdx: number): Promise<void> => {
    const value = opt.values[vIdx];
    if (editMode.value && opt.id && initialData.value?.id && value) {
      const valueMeta = findTrackedValueMeta(opt.id, value);
      if (valueMeta?.id) {
        const requestId = nextAsyncActionRequestId();
        try {
          const impact = await previewDimensionImpact(initialData.value.id as string, {
            action: 'archive_value',
            valueId: valueMeta.id,
          });
          if (!isAsyncActionActive(requestId)) return;
          valueArchiveWizard.open = true;
          valueArchiveWizard.optionIndex = form.options.indexOf(opt);
          valueArchiveWizard.valueIndex = vIdx;
          valueArchiveWizard.valueId = valueMeta.id as string;
          valueArchiveWizard.valueLabel = value;
          valueArchiveWizard.affectedVariantsCount = (impact as Record<string, unknown>)?.data ? ((impact as Record<string, unknown>).data as Record<string, unknown>).affectedVariantsCount as number ?? 0 : 0;
          const sampleVariants = (impact as Record<string, unknown>)?.data ? ((impact as Record<string, unknown>).data as Record<string, unknown>).sampleVariants : [];
          valueArchiveWizard.sampleVariants = Array.isArray(sampleVariants) ? sampleVariants : [];
        } catch (error) {
          if (!isAsyncActionActive(requestId)) return;
          addToast({ message: resolveActionErrorMessage(error), type: 'error' });
        }
        return;
      }
    }
    opt.values.splice(vIdx, 1);
    generateVariants();
  };

  const restoreOptionValue = async (opt: ProductOption, archived: Record<string, unknown>, archivedIndex: number): Promise<void> => {
    const valueId = archived?.id as string;
    const value = String(archived?.value || '').trim();
    if (!value) return;

    if (editMode.value && opt.id && initialData.value?.id && valueId) {
      const requestId = nextAsyncActionRequestId();
      let response;
      try {
        response = await restoreDimensionValue(initialData.value.id as string, valueId);
      } catch (error) {
        if (!isAsyncActionActive(requestId)) return;
        addToast({ message: resolveActionErrorMessage(error), type: 'error' });
        return;
      }
      if (!isAsyncActionActive(requestId)) return;
      if (!(response as Record<string, unknown>)?.success) {
        addToast({ message: ((response as Record<string, unknown>)?.error as string) || t('common.operationFailed'), type: 'error' });
        return;
      }
      updateTrackedDimensionValue(opt.id, value, (currentValue) => ({
        ...(currentValue || archived || {}),
        id: valueId,
        value,
        status: 'active',
      }));
    }

    if (!opt.values.includes(value)) opt.values.push(value);
    if (Array.isArray(opt.archivedValues) && archivedIndex >= 0) {
      opt.archivedValues.splice(archivedIndex, 1);
    }
    generateVariants();
  };

  return {
    addOption,
    removeOption,
    addOptionValue,
    removeOptionValue,
    restoreOptionValue,
    updateTrackedDimensionValue,
    findTrackedValueMeta,
  };
}
