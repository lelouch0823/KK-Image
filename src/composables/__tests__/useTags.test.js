import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockAuthFetch = vi.fn();

vi.mock('@/composables/useAuth', () => ({
  useAuth: () => ({ authFetch: mockAuthFetch }),
}));

vi.mock('@/utils/api-helpers', () => ({
  classifyError: vi.fn((err) => err?._code || 'NETWORK_ERROR'),
  extractErrorMessage: vi.fn((err, fallback) => err?.message || fallback),
}));

describe('useTags', () => {
  let useTags;

  beforeEach(async () => {
    vi.clearAllMocks();
    const mod = await import('../useTags');
    useTags = mod.useTags;
  });

  describe('fetchTags', () => {
    it('应调用 API 获取标签并设置 tags', async () => {
      const mockTags = [
        { id: '1', name: 'VIP', color: '#ff0000' },
        { id: '2', name: 'New', color: '#00ff00' },
      ];
      mockAuthFetch.mockResolvedValue({
        json: () => Promise.resolve({ success: true, data: mockTags }),
      });

      const { fetchTags, tags, loadingTags } = useTags();
      await fetchTags();

      expect(mockAuthFetch).toHaveBeenCalledWith('/api/manage/tags');
      expect(tags.value).toEqual(mockTags);
      expect(loadingTags.value).toBe(false);
    });

    it('加载完成后 loadingTags 应为 false', async () => {
      mockAuthFetch.mockResolvedValue({
        json: () => Promise.resolve({ success: true, data: [] }),
      });

      const { fetchTags, loadingTags } = useTags();
      await fetchTags();

      expect(loadingTags.value).toBe(false);
    });

    it('API 返回 success=false 时不应设置 tags', async () => {
      mockAuthFetch.mockResolvedValue({
        json: () => Promise.resolve({ success: false, data: [] }),
      });

      const { fetchTags, tags } = useTags();
      tags.value = [{ id: 'existing' }];
      await fetchTags();

      // success 为 false 时不会执行 tags.value = data.data
      expect(tags.value).toEqual([{ id: 'existing' }]);
    });

    it('请求异常时应设置 error 和 errorCode', async () => {
      const err = new Error('网络异常');
      err._code = 'NETWORK_ERROR';
      mockAuthFetch.mockRejectedValue(err);

      const { fetchTags, error, errorCode } = useTags();
      await fetchTags();

      expect(error.value).toBe('网络异常');
      expect(errorCode.value).toBe('NETWORK_ERROR');
    });
  });

  describe('createTag', () => {
    it('应调用 API 创建标签并添加到 tags 列表', async () => {
      const newTag = { id: '3', name: 'TagC', color: '#0000ff' };
      mockAuthFetch.mockResolvedValue({
        json: () => Promise.resolve({ success: true, data: newTag }),
      });

      const { createTag, tags } = useTags();
      tags.value = [{ id: '1', name: 'TagA', color: '#ff0000' }];
      const result = await createTag('TagC', '#0000ff');

      expect(mockAuthFetch).toHaveBeenCalledWith('/api/manage/tags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'TagC', color: '#0000ff' }),
      });
      expect(result).toEqual(newTag);
      expect(tags.value).toHaveLength(2);
    });

    it('创建后应按名称字母顺序排序 tags', async () => {
      const newTag = { id: '3', name: 'Alpha', color: '#0000ff' };
      mockAuthFetch.mockResolvedValue({
        json: () => Promise.resolve({ success: true, data: newTag }),
      });

      const { createTag, tags } = useTags();
      tags.value = [
        { id: '1', name: 'Beta', color: '#ff0000' },
        { id: '2', name: 'Gamma', color: '#00ff00' },
      ];
      await createTag('Alpha', '#0000ff');

      expect(tags.value[0].name).toBe('Alpha');
      expect(tags.value[1].name).toBe('Beta');
      expect(tags.value[2].name).toBe('Gamma');
    });

    it('API 返回 success=false 时应抛出错误', async () => {
      mockAuthFetch.mockResolvedValue({
        json: () => Promise.resolve({ success: false, error: '标签名已存在' }),
      });

      const { createTag } = useTags();
      await expect(createTag('Dup', '#000')).rejects.toThrow('标签名已存在');
    });

    it('网络异常时应向上抛出', async () => {
      mockAuthFetch.mockRejectedValue(new Error('网络错误'));

      const { createTag } = useTags();
      await expect(createTag('Fail', '#000')).rejects.toThrow('网络错误');
    });
  });

  describe('assignTag', () => {
    it('应调用 API 分配标签', async () => {
      mockAuthFetch.mockResolvedValue({
        json: () => Promise.resolve({ success: true }),
      });

      const { assignTag } = useTags();
      await assignTag('file-1', 'tag-1');

      expect(mockAuthFetch).toHaveBeenCalledWith('/api/manage/tags/assign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ file_id: 'file-1', tag_id: 'tag-1' }),
      });
    });
  });

  describe('removeTag', () => {
    it('应调用 API 移除标签', async () => {
      mockAuthFetch.mockResolvedValue({
        json: () => Promise.resolve({ success: true }),
      });

      const { removeTag } = useTags();
      await removeTag('file-1', 'tag-1');

      expect(mockAuthFetch).toHaveBeenCalledWith('/api/manage/tags/assign', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ file_id: 'file-1', tag_id: 'tag-1' }),
      });
    });
  });
});
