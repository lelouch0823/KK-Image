import { ref, onMounted, onUnmounted } from 'vue';

/**
 * 灯箱预览 Composable
 * 用于图片画廊的全屏预览
 */
export function useLightbox(files, options = {}) {
  const { onOpen, onClose, onNext, onPrev } = options;

  const visible = ref(false);
  const currentFile = ref(null);
  const currentIndex = ref(0);

  // 打开灯箱
  const open = (file, index = 0) => {
    currentFile.value = file;
    currentIndex.value = index;
    visible.value = true;
    document.body.style.overflow = 'hidden';

    if (onOpen) onOpen(file, index);
  };

  // 关闭灯箱
  const close = () => {
    visible.value = false;
    document.body.style.overflow = '';

    if (onClose) onClose();
  };

  // 上一张
  const prev = () => {
    const filesArray = files.value || files;
    if (currentIndex.value > 0) {
      currentIndex.value--;
      currentFile.value = filesArray[currentIndex.value];

      if (onPrev) onPrev(currentFile.value, currentIndex.value);
    }
  };

  // 下一张
  const next = () => {
    const filesArray = files.value || files;
    if (currentIndex.value < filesArray.length - 1) {
      currentIndex.value++;
      currentFile.value = filesArray[currentIndex.value];

      if (onNext) onNext(currentFile.value, currentIndex.value);
    }
  };

  // 跳转到指定索引
  const goTo = (index) => {
    const filesArray = files.value || files;
    if (index >= 0 && index < filesArray.length) {
      currentIndex.value = index;
      currentFile.value = filesArray[index];
    }
  };

  // 键盘事件处理
  const handleKeydown = (e) => {
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
  const handleWheel = (e) => {
    if (!visible.value) return;

    if (e.deltaY > 0) {
      next();
    } else if (e.deltaY < 0) {
      prev();
    }
  };

  // 计算属性
  const hasPrev = () => currentIndex.value > 0;
  const hasNext = () => {
    const filesArray = files.value || files;
    return currentIndex.value < filesArray.length - 1;
  };
  const total = () => {
    const filesArray = files.value || files;
    return filesArray.length;
  };

  // 注册键盘事件
  onMounted(() => {
    document.addEventListener('keydown', handleKeydown);
  });

  onUnmounted(() => {
    document.removeEventListener('keydown', handleKeydown);
    document.body.style.overflow = '';
  });

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
  };
}
