import { ref } from 'vue';

/**
 * 确认对话框状态管理 composable
 *
 * 统一管理 ConfirmDialog 的 show/title/message/type/loading/onConfirm 状态，
 * 消除各组件中重复的 confirmData ref 定义。
 *
 * @example
 * const { confirmData, askConfirm, handleConfirm } = useConfirmDialog();
 * // 打开确认框：
 * askConfirm({ title: '确认删除', message: '确定要删除吗？', type: 'danger', onConfirm: async () => { ... } });
 * // 模板中：
 * <ConfirmDialog v-model="confirmData.show" :title="confirmData.title" ... @confirm="handleConfirm" />
 */

interface ConfirmOptions {
  title: string;
  message?: string;
  type?: string;
  onConfirm: () => Promise<void> | void;
}

interface ConfirmState {
  show: boolean;
  title: string;
  message: string;
  type: string;
  loading: boolean;
  onConfirm: () => Promise<void> | void;
}

export function useConfirmDialog() {
  const confirmData = ref<ConfirmState>({
    show: false,
    title: '',
    message: '',
    type: 'primary',
    loading: false,
    onConfirm: async () => {},
  });

  /** 打开确认对话框 */
  const askConfirm = (options: ConfirmOptions) => {
    confirmData.value = {
      show: true,
      title: options.title,
      message: options.message || '',
      type: options.type || 'primary',
      loading: false,
      onConfirm: options.onConfirm,
    };
  };

  /** 执行确认回调（带 loading 状态管理） */
  const handleConfirm = async () => {
    confirmData.value.loading = true;
    try {
      await confirmData.value.onConfirm();
    } finally {
      confirmData.value.show = false;
      confirmData.value.loading = false;
    }
  };

  /** 关闭确认对话框 */
  const closeConfirm = () => {
    confirmData.value.show = false;
  };

  return {
    confirmData,
    askConfirm,
    handleConfirm,
    closeConfirm,
  };
}
