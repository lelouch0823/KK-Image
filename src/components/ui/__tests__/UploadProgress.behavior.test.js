import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import UploadProgress from '../UploadProgress.vue';

const mocks = vi.hoisted(() => ({
  queue: { __v_isRef: true, value: [] },
  isUploading: { __v_isRef: true, value: false },
  hasItems: { __v_isRef: true, value: false },
  activeCount: { __v_isRef: true, value: 0 },
  completedCount: { __v_isRef: true, value: 0 },
  overallProgress: { __v_isRef: true, value: 0 },
  isMinimized: { __v_isRef: true, value: false },
  totalSpeed: { __v_isRef: true, value: 0 },
  estimatedTimeRemaining: { __v_isRef: true, value: 0 },
  removeFile: vi.fn(),
  retryFile: vi.fn(),
  retryAllFailed: vi.fn(),
  clearCompleted: vi.fn(),
  clearAll: vi.fn(),
}));

vi.mock('@/composables/useUploadQueue', () => ({
  useUploadQueue: () => ({
    queue: mocks.queue,
    isUploading: mocks.isUploading,
    hasItems: mocks.hasItems,
    activeCount: mocks.activeCount,
    completedCount: mocks.completedCount,
    overallProgress: mocks.overallProgress,
    isMinimized: mocks.isMinimized,
    totalSpeed: mocks.totalSpeed,
    estimatedTimeRemaining: mocks.estimatedTimeRemaining,
    removeFile: mocks.removeFile,
    retryFile: mocks.retryFile,
    retryAllFailed: mocks.retryAllFailed,
    clearCompleted: mocks.clearCompleted,
    clearAll: mocks.clearAll,
  }),
}));

vi.mock('@/composables/useI18n', () => ({
  useI18n: () => ({
    t: (key, args) => {
      const map = {
        'upload.complete': 'Complete',
        'upload.finished': 'finished',
        'upload.remaining': 'remaining',
        'upload.done': 'Done',
        'upload.waiting': 'Waiting',
        'common.failed': 'Failed',
        'common.retryAllFailed': 'Retry all failed',
        'upload.clearCompleted': 'Clear completed',
        'common.clearAll': 'Clear all',
        'upload.retry': 'Retry',
      };
      if (key === 'upload.uploading') return `Uploading ${args.count}`;
      return map[key] || key;
    },
  }),
}));

describe('UploadProgress behavior', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.queue.value = [];
    mocks.isUploading.value = false;
    mocks.hasItems.value = false;
    mocks.activeCount.value = 0;
    mocks.completedCount.value = 0;
    mocks.overallProgress.value = 0;
    mocks.isMinimized.value = false;
    mocks.totalSpeed.value = 0;
    mocks.estimatedTimeRemaining.value = 0;
  });

  function createWrapper() {
    return mount(UploadProgress, {
      global: {
        stubs: {
          transition: false,
          'transition-group': false,
          AppIcon: {
            props: ['name'],
            template: '<i :data-icon="name" />',
          },
        },
      },
    });
  }

  it('stays hidden when there are no queue items', () => {
    const wrapper = createWrapper();

    expect(wrapper.text()).toBe('');
  });

  it('renders uploading progress, speeds, remaining time, and file statuses', () => {
    mocks.queue.value = [
      { id: '1', name: 'hero.png', status: 'uploading', progress: 35, speed: 1024 },
      { id: '2', name: 'done.jpg', status: 'success', progress: 100, speed: 0 },
      { id: '3', name: 'bad.pdf', status: 'error', progress: 20, speed: 0, error: 'Network fail' },
      { id: '4', name: 'wait.gif', status: 'pending', progress: 0, speed: 0 },
    ];
    mocks.isUploading.value = true;
    mocks.hasItems.value = true;
    mocks.activeCount.value = 1;
    mocks.completedCount.value = 1;
    mocks.overallProgress.value = 42;
    mocks.totalSpeed.value = 2048;
    mocks.estimatedTimeRemaining.value = 65;

    const wrapper = createWrapper();

    expect(wrapper.text()).toContain('Uploading 1');
    expect(wrapper.text()).toContain('1 / 4 finished');
    expect(wrapper.text()).toContain('2.0 KB/s');
    expect(wrapper.text()).toContain('remaining');
    expect(wrapper.text()).toContain('35% · 1.0 KB/s');
    expect(wrapper.text()).toContain('Done');
    expect(wrapper.text()).toContain('Network fail');
    expect(wrapper.text()).toContain('Waiting');
    expect(wrapper.text()).toContain('hero.png');
    expect(wrapper.find('[data-icon="spinner"]').exists()).toBe(true);
  });

  it('toggles minimize state and shows compact percentage view', async () => {
    mocks.queue.value = [{ id: '1', name: 'hero.png', status: 'success', progress: 100, speed: 0 }];
    mocks.hasItems.value = true;
    mocks.overallProgress.value = 87;
    mocks.isMinimized.value = true;

    const wrapper = createWrapper();

    expect(wrapper.text()).toContain('87%');

    await wrapper.find('button').trigger('click');

    expect(mocks.isMinimized.value).toBe(false);
  });

  it('fires queue action handlers for retry, clear, and remove controls', async () => {
    mocks.queue.value = [
      { id: '1', name: 'bad.pdf', status: 'error', progress: 20, speed: 0, error: 'Network fail' },
      { id: '2', name: 'wait.gif', status: 'pending', progress: 0, speed: 0 },
      { id: '3', name: 'done.jpg', status: 'success', progress: 100, speed: 0 },
    ];
    mocks.hasItems.value = true;
    mocks.failedCount = 1;

    const wrapper = createWrapper();
    const buttons = wrapper.findAll('button');

    await buttons[1].trigger('click');
    await buttons[2].trigger('click');
    await buttons[3].trigger('click');
    await buttons[4].trigger('click');
    await buttons[5].trigger('click');

    expect(mocks.retryAllFailed).toHaveBeenCalled();
    expect(mocks.clearCompleted).toHaveBeenCalled();
    expect(mocks.clearAll).toHaveBeenCalled();
    expect(mocks.retryFile).toHaveBeenCalledWith('1');
    expect(mocks.removeFile).toHaveBeenCalledWith('2');
  });
});
