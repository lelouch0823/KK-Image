import { ref, computed, onMounted, onScopeDispose, type Ref } from 'vue';

interface LightboxOptions {
  onOpen?: (file: any, index: number) => void;
  onClose?: () => void;
  onNext?: (file: any, index: number) => void;
  onPrev?: (file: any, index: number) => void;
}

/**
 * 灯箱预览 Composable
 * 用于图片画廊的全屏预览
 */
export function useLightbox(files: Ref<any[]> | any[], options: LightboxOptions = {}) {
  const { onOpen, onClose, onNext, onPrev } = options;

  const visible = ref<boolean>(false);
  const currentFile = ref<any>(null);
  const currentIndex = ref<number>(0);

  // 统一获取数组的辅助函数
  const getFilesArray = (): any[] => {
    return Array.isArray(files) ? files : (files as Ref<any[]>).value || [];
  };

  // 打开灯箱
  const open = (file: any, index: number = 0): void => {
    currentFile.value = file;
    currentIndex.value = index;
    visible.value = true;
    document.body.style.overflow = 'hidden';

    if (onOpen) onOpen(file, index);
  };

  // 关闭灯箱
  const close = (): void => {
    visible.value = false;
    document.body.style.overflow = '';

    if (onClose) onClose();
  };

  // 上一张
  const prev = (): void => {
    const filesArray = getFilesArray();
    if (currentIndex.value > 0) {
      currentIndex.value--;
      currentFile.value = filesArray[currentIndex.value];

      if (onPrev) onPrev(currentFile.value, currentIndex.value);
    }
  };

  // 下一张
  const next = (): void => {
    const filesArray = getFilesArray();
    if (currentIndex.value < filesArray.length - 1) {
      currentIndex.value++;
      currentFile.value = filesArray[currentIndex.value];

      if (onNext) onNext(currentFile.value, currentIndex.value);
    }
  };

  // 跳转到指定索引
  const goTo = (index: number): void => {
    const filesArray = getFilesArray();
    if (index >= 0 && index < filesArray.length) {
      currentIndex.value = index;
      currentFile.value = filesArray[index];
    }
  };

  // 键盘事件处理
  const handleKeydown = (e: KeyboardEvent): void => {
    if (!visible.value) return;

    switch (e.key) {
      case 'Escape':
        close();
        break;
      case 'ArrowLeft':
        prev();
        break;
      case 'ArrowRight':
        next();
        break;
    }
  };

  // 滚轮事件处理
  const handleWheel = (e: WheelEvent): void => {
    if (!visible.value) return;

    if (e.deltaY > 0) {
      next();
    } else if (e.deltaY < 0) {
      prev();
    }
  };

  // 计算属性
  const hasPrev = computed(() => currentIndex.value > 0);
  const hasNext = computed(() => {
    const filesArray = getFilesArray();
    return currentIndex.value < filesArray.length - 1;
  });
  const total = computed(() => {
    const filesArray = getFilesArray();
    return filesArray.length;
  });

  // 注册键盘事件
  onMounted(() => {
    document.addEventListener('keydown', handleKeydown);
  });

  onScopeDispose(() => {
    document.removeEventListener('keydown', handleKeydown);
    document.body.style.overflow = '';
  });

  // 下载助手
  const download = (file: any): void => {
    if (!file?.url) return;

    const a = document.createElement('a');
    a.href = file.url;
    a.download = file.name || 'download';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return {
    visible,
    currentFile,
    currentIndex,
    open,
    close,
    prev,
    next,
    goTo,
    hasPrev,
    hasNext,
    total,
    handleWheel,
    download,
  };
}
