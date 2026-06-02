import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { reactive, ref } from 'vue';

// 模拟 useI18n - 返回 key 作为翻译结果
vi.mock('@/composables/useI18n', () => ({
  useI18n: () => ({
    t: (key: string, params?: Record<string, unknown>) => {
      if (params?.count !== undefined) return `${params.count}${key}`;
      return key;
    },
    locale: ref('zh-CN'),
  }),
}));

import { useFormDraft } from '../useFormDraft';

/**
 * useFormDraft 测试
 *
 * 覆盖场景：
 * - 基本存取：草稿检测、恢复、清除
 * - 版本控制：版本不匹配时旧草稿自动失效
 * - 自动保存：防抖写入 localStorage
 * - 边界场景：损坏数据、quota 超限、空数据
 */

// 模拟 localStorage
let store: Record<string, string>;
const localStorageMock: Storage = {
  getItem: vi.fn((key: string) => store[key] ?? null),
  setItem: vi.fn((key: string, value: string) => {
    store[key] = value;
  }),
  removeItem: vi.fn((key: string) => {
    delete store[key];
  }),
  clear: vi.fn(() => {
    store = {};
  }),
  get length() {
    return Object.keys(store).length;
  },
  key: vi.fn((index: number) => Object.keys(store)[index] ?? null),
};

// 等待指定毫秒（使用真实 setTimeout）
function waitReal(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

describe('useFormDraft', () => {
  beforeEach(() => {
    store = {};
    vi.spyOn(window, 'localStorage', 'get').mockReturnValue(localStorageMock);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ---- 基本存取 ----

  it('should detect existing draft on init', () => {
    store['kk-draft:test'] = JSON.stringify({
      version: 1,
      timestamp: Date.now(),
      data: { name: '已保存', remark: '草稿内容' },
    });

    const data = reactive({ name: '', remark: '' });
    const { hasDraft, draftData, getDraftAgeText } = useFormDraft({
      key: 'test',
      data,
    });

    expect(hasDraft.value).toBe(true);
    expect(draftData.value).toEqual({ name: '已保存', remark: '草稿内容' });
    expect(getDraftAgeText()).toBeTruthy();
  });

  it('should restore draft data to form', () => {
    store['kk-draft:test'] = JSON.stringify({
      version: 1,
      timestamp: Date.now(),
      data: { name: '恢复的名称', count: 5 },
    });

    const data = reactive({ name: '', count: 0 });
    const { hasDraft, restoreDraft } = useFormDraft({
      key: 'test',
      data,
    });

    expect(hasDraft.value).toBe(true);

    restoreDraft();

    expect(data.name).toBe('恢复的名称');
    expect(data.count).toBe(5);
    expect(hasDraft.value).toBe(false);
  });

  it('should clear draft', () => {
    store['kk-draft:test'] = JSON.stringify({
      version: 1,
      timestamp: Date.now(),
      data: { name: '待清除' },
    });

    const data = reactive({ name: '' });
    const { hasDraft, clearDraft } = useFormDraft({
      key: 'test',
      data,
    });

    expect(hasDraft.value).toBe(true);

    clearDraft();

    expect(hasDraft.value).toBe(false);
    expect(store['kk-draft:test']).toBeUndefined();
  });

  // ---- 自动保存 ----

  it('should auto-save after debounce', async () => {
    const data = reactive({ name: '' });
    useFormDraft({ key: 'test', data, debounce: 100 });

    data.name = '新名称';

    // debounce 前不应写入
    await waitReal(50);
    expect(store['kk-draft:test']).toBeUndefined();

    // 等待 debounce 完成
    await waitReal(100);

    expect(store['kk-draft:test']).toBeDefined();
    const saved = JSON.parse(store['kk-draft:test']);
    expect(saved.data.name).toBe('新名称');
    expect(saved.timestamp).toBeGreaterThan(0);
  });

  it('should debounce multiple rapid changes', async () => {
    const data = reactive({ name: '' });
    useFormDraft({ key: 'test', data, debounce: 100 });

    data.name = '第一次';
    await waitReal(30);
    data.name = '第二次';
    await waitReal(30);
    data.name = '最终值';

    // 等待 debounce 完成
    await waitReal(150);

    const saved = JSON.parse(store['kk-draft:test']);
    expect(saved.data.name).toBe('最终值');
  });

  // ---- 版本控制 ----

  it('should discard draft with mismatched version', () => {
    store['kk-draft:test'] = JSON.stringify({
      version: 99,
      timestamp: Date.now(),
      data: { name: '旧版本' },
    });

    const data = reactive({ name: '' });
    const { hasDraft } = useFormDraft({ key: 'test', data, version: 1 });

    expect(hasDraft.value).toBe(false);
    expect(store['kk-draft:test']).toBeUndefined();
  });

  it('should use custom version in snapshot', async () => {
    const data = reactive({ name: '测试' });
    useFormDraft({ key: 'test', data, debounce: 50, version: 3 });

    data.name = '版本3';
    await waitReal(100);

    const saved = JSON.parse(store['kk-draft:test']);
    expect(saved.version).toBe(3);
  });

  // ---- exclude 排除字段 ----

  it('should exclude specified fields from draft', async () => {
    const data = reactive({ name: '名称', files: ['file1.jpg'] });
    useFormDraft({ key: 'test', data, debounce: 50, exclude: ['files'] });

    data.name = '包含排除';
    await waitReal(100);

    const saved = JSON.parse(store['kk-draft:test']);
    expect(saved.data.name).toBe('包含排除');
    expect(saved.data.files).toBeUndefined();
  });

  // ---- 边界场景 ----

  it('should handle corrupted JSON gracefully', () => {
    store['kk-draft:test'] = '{ invalid json !!!';

    const data = reactive({ name: '' });
    const { hasDraft } = useFormDraft({ key: 'test', data });

    expect(hasDraft.value).toBe(false);
    expect(store['kk-draft:test']).toBeUndefined();
  });

  it('should handle malformed draft structure', () => {
    store['kk-draft:test'] = JSON.stringify({ version: 1, timestamp: 123 });

    const data = reactive({ name: '' });
    const { hasDraft } = useFormDraft({ key: 'test', data });

    expect(hasDraft.value).toBe(false);
  });

  it('should not propose restore for empty draft data', () => {
    store['kk-draft:test'] = JSON.stringify({
      version: 1,
      timestamp: Date.now(),
      data: { name: '', count: 0, active: false },
    });

    const data = reactive({ name: '', count: 0, active: false });
    const { hasDraft } = useFormDraft({ key: 'test', data });

    expect(hasDraft.value).toBe(false);
  });

  it('should handle QuotaExceededError on save', async () => {
    vi.spyOn(localStorageMock, 'setItem').mockImplementation(() => {
      throw new DOMException('QuotaExceededError', 'QuotaExceededError');
    });

    const data = reactive({ name: '' });
    useFormDraft({ key: 'test', data, debounce: 50 });

    data.name = '超限测试';
    await expect(waitReal(100)).resolves.not.toThrow();
  });

  it('should not propose draft for different key', () => {
    store['kk-draft:other-key'] = JSON.stringify({
      version: 1,
      timestamp: Date.now(),
      data: { name: '其他表单' },
    });

    const data = reactive({ name: '' });
    const { hasDraft } = useFormDraft({ key: 'test', data });

    expect(hasDraft.value).toBe(false);
  });

  // ---- relative time ----

  it('should format relative time correctly', () => {
    const now = Date.now();
    store['kk-draft:test'] = JSON.stringify({
      version: 1,
      timestamp: now - 30_000,
      data: { name: '草稿' },
    });

    const data = reactive({ name: '' });
    const { getDraftAgeText } = useFormDraft({ key: 'test', data });

    expect(getDraftAgeText()).toBe('formDraft.justNow');
  });

  it('should format minutes ago', () => {
    const now = Date.now();
    store['kk-draft:test'] = JSON.stringify({
      version: 1,
      timestamp: now - 5 * 60_000,
      data: { name: '草稿' },
    });

    const data = reactive({ name: '' });
    const { getDraftAgeText } = useFormDraft({ key: 'test', data });

    expect(getDraftAgeText()).toBe('5formDraft.minutesAgo');
  });

  it('should format hours ago', () => {
    const now = Date.now();
    store['kk-draft:test'] = JSON.stringify({
      version: 1,
      timestamp: now - 3 * 3600_000,
      data: { name: '草稿' },
    });

    const data = reactive({ name: '' });
    const { getDraftAgeText } = useFormDraft({ key: 'test', data });

    expect(getDraftAgeText()).toBe('3formDraft.hoursAgo');
  });

  it('should format days ago', () => {
    const now = Date.now();
    store['kk-draft:test'] = JSON.stringify({
      version: 1,
      timestamp: now - 2 * 86400_000,
      data: { name: '草稿' },
    });

    const data = reactive({ name: '' });
    const { getDraftAgeText } = useFormDraft({ key: 'test', data });

    expect(getDraftAgeText()).toBe('2formDraft.daysAgo');
  });

  // ---- restoreDraft is idempotent ----

  it('should be safe to call restoreDraft when no draft', () => {
    const data = reactive({ name: '' });
    const { restoreDraft } = useFormDraft({ key: 'test', data });

    expect(() => restoreDraft()).not.toThrow();
  });

  // ---- Ref data ----

  it('should work with Ref data', () => {
    store['kk-draft:test'] = JSON.stringify({
      version: 1,
      timestamp: Date.now(),
      data: { title: 'Ref 数据' },
    });

    const data = ref({ title: '' });
    const { hasDraft, restoreDraft } = useFormDraft({
      key: 'test',
      data: data as Parameters<typeof useFormDraft>[0]['data'],
    });

    expect(hasDraft.value).toBe(true);

    restoreDraft();

    expect(data.value.title).toBe('Ref 数据');
  });

  // ---- draft data isolation ----

  it('should store snapshot copy, not reference to original data', async () => {
    const data = reactive({ name: '原始' });
    useFormDraft({ key: 'test', data, debounce: 50 });

    data.name = '快照测试';
    await waitReal(100);

    // 修改原数据不应影响已保存的快照
    data.name = '再次修改';
    const saved = JSON.parse(store['kk-draft:test']);
    expect(saved.data.name).toBe('快照测试');
  });

  // ---- multiple instances ----

  it('should isolate drafts by key', async () => {
    const dataA = reactive({ name: 'A' });
    const dataB = reactive({ name: 'B' });

    useFormDraft({ key: 'form-a', data: dataA, debounce: 50 });
    useFormDraft({ key: 'form-b', data: dataB, debounce: 50 });

    dataA.name = '更新A';
    dataB.name = '更新B';
    await waitReal(100);

    const savedA = JSON.parse(store['kk-draft:form-a']);
    const savedB = JSON.parse(store['kk-draft:form-b']);

    expect(savedA.data.name).toBe('更新A');
    expect(savedB.data.name).toBe('更新B');
  });
});
