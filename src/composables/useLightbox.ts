import { ref, computed, type Ref } from 'vue';

/** 灯箱文件项接口 */
interface LightboxFile {
  id?: string;
  url: string;
  name?: string;
  [key: string]: unknown;
}

interface LightboxOptions {
  onOpen?: (file: LightboxFile, index: number) => void;
  onClose?: () => void;
  onNext?: (file: LightboxFile, index: number) => void;
  onPrev?: (file: LightboxFile, index: number) => void;
}

/**
 * 灯箱预览 Composable
 * 用于图片画廊的全屏预览
 *
 * 注意：键盘交互（Esc/←/→）与 body 滚动锁由 Lightbox 组件统一负责，
 * 此处只管理打开状态与当前文件，避免与组件内的 document 监听重复触发
 * （曾导致按一次方向键跳两张）。
 */
export function useLightbox(files: Ref<LightboxFile[]> | LightboxFile[], options: LightboxOptions = {}) {
  const { onOpen, onClose, onNext, onPrev } = options;

  const visible = ref<boolean>(false);
  const currentFile = ref<LightboxFile | null>(null);
  const currentIndex = ref<number>(0);

  // 统一获取数组的辅助函数
  const getFilesArray = (): LightboxFile[] => {
    return Array.isArray(files) ? files : (files as Ref<LightboxFile[]>).value || [];
  };

  // 打开灯箱
  const open = (file: LightboxFile, index: number = 0): void => {
    currentFile.value = file;
    currentIndex.value = index;
    visible.value = true;

    if (onOpen) onOpen(file, index);
  };

  // 关闭灯箱
  const close = (): void => {
    visible.value = false;

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

  // 下载助手
  const download = (file: LightboxFile): void => {
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
    download,
  };
}
