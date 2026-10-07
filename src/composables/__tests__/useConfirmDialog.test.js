import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useConfirmDialog } from '../useConfirmDialog';

const mockAddToast = vi.fn();

vi.mock('../useToast', () => ({
  useToast: () => ({ addToast: mockAddToast }),
}));

vi.mock('../useI18n', () => ({
  useI18n: () => ({ t: (key) => key }),
}));

describe('useConfirmDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('closes the dialog and resets loading when onConfirm succeeds', async () => {
    const { confirmData, askConfirm, handleConfirm } = useConfirmDialog();
    const onConfirm = vi.fn().mockResolvedValue(undefined);

    askConfirm({ title: '确认删除', onConfirm });
    expect(confirmData.value.show).toBe(true);

    await handleConfirm();

    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(confirmData.value.show).toBe(false);
    expect(confirmData.value.loading).toBe(false);
    expect(mockAddToast).not.toHaveBeenCalled();
  });

  it('keeps the dialog open and shows an error toast when onConfirm rejects', async () => {
    const { confirmData, askConfirm, handleConfirm } = useConfirmDialog();
    const failure = Object.assign(new Error('库存不足，无法归档'), {
      status: 400,
      data: { error: '库存不足，无法归档' },
    });
    askConfirm({ title: '状态变更', onConfirm: vi.fn().mockRejectedValue(failure) });

    await handleConfirm();

    // 失败时弹窗保持打开，用户可修正后重试或取消
    expect(confirmData.value.show).toBe(true);
    expect(confirmData.value.loading).toBe(false);
    expect(mockAddToast).toHaveBeenCalledTimes(1);
    expect(mockAddToast).toHaveBeenCalledWith({ message: '库存不足，无法归档', type: 'error' });
  });

  it('falls back to a generic message when the error carries no readable message', async () => {
    const { confirmData, askConfirm, handleConfirm } = useConfirmDialog();
    askConfirm({ title: '确认', onConfirm: vi.fn().mockRejectedValue(undefined) });

    await handleConfirm();

    expect(confirmData.value.show).toBe(true);
    expect(mockAddToast).toHaveBeenCalledWith({ message: 'common.operationFailed', type: 'error' });
  });

  it('can be closed manually via closeConfirm after a failure', async () => {
    // 回归：原实现 finally 无条件 show=false，失败也被静默关闭
    const { confirmData, askConfirm, handleConfirm, closeConfirm } = useConfirmDialog();
    askConfirm({ title: '确认', onConfirm: vi.fn().mockRejectedValue(new Error('boom')) });

    await handleConfirm();
    expect(confirmData.value.show).toBe(true);

    // 用户手动取消后弹窗才关闭
    closeConfirm();
    expect(confirmData.value.show).toBe(false);
  });

  it('applies default type and empty message in askConfirm', () => {
    const { confirmData, askConfirm } = useConfirmDialog();
    askConfirm({ title: '确认', onConfirm: async () => {} });

    expect(confirmData.value.type).toBe('primary');
    expect(confirmData.value.message).toBe('');
  });
});
