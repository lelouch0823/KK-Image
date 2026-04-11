import { beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import SpaceDetailModal from '../SpaceDetailModal.vue';

const mocks = vi.hoisted(() => ({
  loadSpace: vi.fn(),
  updateSpace: vi.fn(),
  addFilesToSpace: vi.fn(),
  removeFilesFromSpace: vi.fn(),
  addToast: vi.fn(),
}));

vi.mock('@/composables/useSpaces', () => ({
  useSpaces: () => ({
    loadSpace: mocks.loadSpace,
    updateSpace: mocks.updateSpace,
    addFilesToSpace: mocks.addFilesToSpace,
    removeFilesFromSpace: mocks.removeFilesFromSpace,
  }),
}));

vi.mock('@/composables/useToast', () => ({
  useToast: () => ({
    addToast: mocks.addToast,
  }),
}));

vi.mock('@/composables/useI18n', () => ({
  useI18n: () => ({
    t: (_key, fallback) => fallback || '',
  }),
}));

describe('SpaceDetailModal lifecycle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('ignores stale detail loads after switching spaces', async () => {
    let resolveFirst;
    mocks.loadSpace
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveFirst = resolve;
          })
      )
      .mockResolvedValueOnce({
        id: 'space-b',
        name: '空间 B',
        template: 'gallery',
        isPublic: true,
        files: [],
      });

    const wrapper = mount(SpaceDetailModal, {
      props: {
        space: { id: 'space-a' },
        canManage: true,
      },
      global: {
        stubs: {
          Modal: {
            template: '<div><slot name="header" /><slot /><slot name="footer" /></div>',
            props: ['modelValue'],
          },
          StatusBadge: { template: '<div><slot /></div>' },
          FileSelector: { template: '<div />' },
          SpaceAnalytics: { template: '<div />' },
          SubspaceList: { template: '<div />' },
          SpaceFilesTab: { template: '<div />' },
          SpaceSettingsTab: { template: '<div />' },
        },
      },
    });

    await wrapper.setProps({
      space: { id: 'space-b' },
    });
    await flushPromises();

    expect(wrapper.text()).toContain('空间 B');

    resolveFirst({
      id: 'space-a',
      name: '过期空间 A',
      template: 'gallery',
      isPublic: true,
      files: [],
    });
    await flushPromises();
    await flushPromises();

    expect(wrapper.text()).toContain('空间 B');
    expect(wrapper.text()).not.toContain('过期空间 A');
  });

  it('does not report success or refresh detail when share settings update fails', async () => {
    mocks.loadSpace.mockResolvedValue({
      id: 'space-a',
      name: '空间 A',
      template: 'gallery',
      isPublic: true,
      files: [],
      sharedSalespersons: [],
      shareMode: 'none',
    });
    mocks.updateSpace.mockResolvedValue(false);

    const wrapper = mount(SpaceDetailModal, {
      props: {
        space: { id: 'space-a' },
        canManage: true,
      },
      global: {
        stubs: {
          Modal: {
            template: '<div><slot name="header" /><slot /><slot name="footer" /></div>',
            props: ['modelValue'],
          },
          StatusBadge: { template: '<div><slot /></div>' },
          FileSelector: { template: '<div />' },
          SpaceAnalytics: { template: '<div />' },
          SubspaceList: { template: '<div />' },
          SpaceFilesTab: { template: '<div />' },
          SpaceSettingsTab: {
            template:
              '<button data-testid="save-share" @click="$emit(\'update-share-settings\', { shareMode: \'selected\', sharedSalespersonIds: [\'sp-1\'] })">save</button>',
          },
        },
      },
    });

    await flushPromises();
    expect(mocks.loadSpace).toHaveBeenCalledTimes(1);

    await wrapper.get('[data-testid="save-share"]').trigger('click');
    await flushPromises();

    expect(mocks.updateSpace).toHaveBeenCalledWith('space-a', {
      shareMode: 'selected',
      sharedSalespersonIds: ['sp-1'],
    });
    expect(mocks.loadSpace).toHaveBeenCalledTimes(1);
    expect(mocks.addToast).not.toHaveBeenCalledWith(
      expect.objectContaining({ type: 'success' })
    );
    expect(wrapper.emitted('updated')).toBeUndefined();
  });

  it('clears stale detail state when switching to a space that fails to load', async () => {
    mocks.loadSpace
      .mockResolvedValueOnce({
        id: 'space-a',
        name: '空间 A',
        template: 'gallery',
        isPublic: true,
        files: [],
      })
      .mockResolvedValueOnce(null);

    const wrapper = mount(SpaceDetailModal, {
      props: {
        space: { id: 'space-a' },
        canManage: true,
      },
      global: {
        stubs: {
          Modal: {
            template: '<div><slot name="header" /><slot /><slot name="footer" /></div>',
            props: ['modelValue'],
          },
          StatusBadge: { template: '<div><slot /></div>' },
          FileSelector: { template: '<div />' },
          SpaceAnalytics: { template: '<div />' },
          SubspaceList: { template: '<div />' },
          SpaceFilesTab: { template: '<div />' },
          SpaceSettingsTab: { template: '<div />' },
        },
      },
    });

    await flushPromises();
    expect(wrapper.text()).toContain('空间 A');

    await wrapper.setProps({
      space: { id: 'space-b' },
    });
    await flushPromises();

    expect(wrapper.vm.spaceData).toBe(null);
    expect(wrapper.text()).not.toContain('空间 A');
  });
});
