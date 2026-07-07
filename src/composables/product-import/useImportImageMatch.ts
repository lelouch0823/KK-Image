import { ref, computed } from 'vue';
import { useAuth } from '@/composables/useAuth';
import { API } from '@/utils/constants';
import { getItemMatchKey } from '@/utils/import-match-keys';

export function useImportImageMatch({ t, addToast, parsedItems, workflow }) {
  const { authFetch } = useAuth();

  const imageUploadFiles = ref([]);
  const imageMatches = ref(new Map());

  const handleImageFiles = (files) => {
    const fileArray = Array.from(files || []);
    imageUploadFiles.value = [...imageUploadFiles.value, ...fileArray];
    performImageMatch();
  };

  const performImageMatch = () => {
    const newMatches = new Map();

    parsedItems.value.forEach((item) => {
      if (!item.image_url || item.image_url.match(/^https?:\/\//i)) return;

      const target = String(item.image_url).trim();
      const match = imageUploadFiles.value.find(
        (f) => f.name === target || f.name.includes(target)
      );

      if (match) {
        newMatches.set(getItemMatchKey(item), match);
      }
    });
    imageMatches.value = newMatches;
  };

  const processedImagesCount = computed(() => imageMatches.value.size);
  const totalImagesCount = computed(
    () => parsedItems.value.filter((i) => i.image_url && !i.image_url.match(/^https?:\/\//i)).length
  );

  const handleUploadImagesAndNext = async ({ confirmData }) => {
    if (imageMatches.value.size === 0) {
      confirmData.value = {
        show: true,
        title: t('common.confirmTitle'),
        message: t('product.import.match_hint'),
        type: 'warning',
        loading: false,
        onConfirm: () => {
          confirmData.value.show = false;
          workflow.currentStep.value = 4;
        },
      };
      return;
    }

    const requestId = workflow.getImageUploadRequestId();
    // loading is managed by the caller
    try {
      const matches = Array.from(imageMatches.value.entries());
      let uploadedCount = 0;
      let failedCount = 0;

      for (const [key, file] of matches) {
        const formData = new FormData();
        formData.append('file', file);

        const res = await authFetch(`${API.MANAGE_UPLOAD}?context=product`, {
          method: 'POST',
          body: formData,
        });
        if (!workflow.isImageUploadActive(requestId)) return { cancelled: true };
        const data = await res.json();
        if (!workflow.isImageUploadActive(requestId)) return { cancelled: true };

        if (data.success) {
          const item = parsedItems.value.find((i) => getItemMatchKey(i) === key);
          if (item) {
            item.images = [data.result.id];
            delete item.image_url;
          }
          uploadedCount++;
        } else {
          failedCount++;
        }
      }

      if (!workflow.isImageUploadActive(requestId)) return { cancelled: true };
      if (uploadedCount === 0) {
        addToast({
          message: t('product.import.upload_failed', { message: t('common.operationFailed') }),
          type: 'error',
        });
        return { cancelled: true };
      }
      if (failedCount > 0) {
        addToast({
          message: t(
            'product.import.upload_partial',
            { success: uploadedCount, failed: failedCount },
            `已上传 ${uploadedCount} 张图片，${failedCount} 张失败`
          ),
          type: 'warning',
        });
      } else {
        addToast({
          message: t('product.import.upload_success', { count: uploadedCount }),
          type: 'success',
        });
      }
      workflow.currentStep.value = 4;
      return { cancelled: false };
    } catch (e) {
      if (!workflow.isImageUploadActive(requestId)) return { cancelled: true };
      console.error(e);
      addToast({ message: t('product.import.upload_failed', { message: e.message }), type: 'error' });
      return { cancelled: true };
    }
  };

  const resetImageMatch = () => {
    imageUploadFiles.value = [];
    imageMatches.value = new Map();
  };

  return {
    imageUploadFiles,
    imageMatches,
    handleImageFiles,
    performImageMatch,
    processedImagesCount,
    totalImagesCount,
    handleUploadImagesAndNext,
    resetImageMatch,
  };
}
