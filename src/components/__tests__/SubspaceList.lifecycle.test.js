import { beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import SubspaceList from '../SubspaceList.vue';

const mocks = vi.hoisted(() => ({
  loadSubspaces: vi.fn(),
  deleteSpace: vi.fn(),
  addToast: vi.fn(),
  copyShareLink: vi.fn(),
}));

vi.mock('@/composables/useSpaces', () => ({
  useSpaces: () => ({
    loadSubspaces: mocks.loadSubspaces,
    deleteSpace: mocks.deleteSpace,
  }),
}));

vi.mock('@/composables/useToast', () => ({
  useToast: () => ({
    addToast: mocks.addToast,
  }),
}));

vi.mock('@/composables/useClipboard', () => ({
  useClipboard: () => ({
    copyShareLink: mocks.copyShareLink,
  }),
}));

vi.mock('@/composables/useI18n', () => ({
  useI18n: () => ({
    t: (_key, fallback) => fallback || '',
  }),
}));

describe('SubspaceList lifecycle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('reloads subspaces for the latest space id and ignores stale results', async () => {
    let resolveFirst;
    let resolveSecond;
    mocks.loadSubspaces
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveFirst = resolve;
          })
      )
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveSecond = resolve;
          })
      );

    const wrapper = mount(SubspaceList, {
      props: {
        spaceId: 'space-a',
        canManage: true,
      },
      global: {
        stubs: {
          Tooltip: { template: '<div><slot /></div>' },
          SpaceCreateModal: { template: '<div />' },
          ConfirmDialog: { template: '<div />' },
          AppImage: { template: '<img />', props: ['src', 'alt'] },
          AppButton: { template: '<button><slot /></button>' },
        },
      },
    });

    await wrapper.setProps({ spaceId: 'space-b' });
    await flushPromises();
    expect(mocks.loadSubspaces).toHaveBeenCalledTimes(2);

    resolveSecond([
      {
        id: 'sub-b-1',
        name: 'B 子空间',
        template: 'gallery',
        fileCount: 2,
        isPublic: true,
        coverUrl: '',
      },
    ]);
    await flushPromises();

    expect(wrapper.text()).toContain('B 子空间');

    resolveFirst([
      {
        id: 'sub-a-1',
        name: 'A 子空间',
        template: 'gallery',
        fileCount: 1,
        isPublic: true,
        coverUrl: '',
      },
    ]);
    await flushPromises();
    await flushPromises();

    expect(wrapper.text()).toContain('B 子空间');
    expect(wrapper.text()).not.toContain('A 子空间');
  });

  it('keeps the delete confirmation open when deleting a subspace fails', async () => {
    mocks.loadSubspaces.mockResolvedValue([
      {
        id: 'sub-a-1',
        name: 'A 子空间',
        template: 'gallery',
        fileCount: 1,
        isPublic: true,
        coverUrl: '',
      },
    ]);
    mocks.deleteSpace.mockResolvedValue(false);

    const wrapper = mount(SubspaceList, {
      props: {
        spaceId: 'space-a',
        canManage: true,
      },
      global: {
        stubs: {
          Tooltip: { template: '<div><slot /></div>' },
          SpaceCreateModal: { template: '<div />' },
          ConfirmDialog: { template: '<div />' },
          AppImage: { template: '<img />', props: ['src', 'alt'] },
          AppButton: { template: '<button><slot /></button>' },
        },
      },
    });

    await flushPromises();

    wrapper.vm.deleteSubspace({ id: 'sub-a-1', name: 'A 子空间' });
    await wrapper.vm.confirmData.onConfirm();

    expect(mocks.deleteSpace).toHaveBeenCalledWith('sub-a-1');
    expect(wrapper.vm.confirmData.show).toBe(true);
  });
});
