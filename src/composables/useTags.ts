import { ref } from 'vue';
import { useAuth } from '@/composables/useAuth';
import { useI18n } from '@/composables/useI18n';
import { classifyError, extractErrorMessage } from '@/utils/api-helpers';

/** 标签接口 */
interface Tag {
  id: string;
  name: string;
  color: string;
  [key: string]: unknown;
}

/** API 通用响应结构 */
interface TagsApiResponse {
  success: boolean;
  data?: Tag | Tag[];
  error?: string;
  [key: string]: unknown;
}

const tags = ref<Tag[]>([]);
const loadingTags = ref<boolean>(false);
const error = ref<string | null>(null);
const errorCode = ref<string | null>(null);

/** 请求 ID 守卫，防止过期请求覆盖最新数据 */
let fetchRequestId = 0;

export function useTags() {
    const { authFetch } = useAuth();
    const { t } = useI18n();

    const fetchTags = async (): Promise<void> => {
        const requestId = ++fetchRequestId;
        loadingTags.value = true;
        error.value = null;
        errorCode.value = null;
        try {
            const res = await authFetch('/api/manage/tags');
            // 如果已有更新的请求发起，丢弃本次结果
            if (requestId !== fetchRequestId) return;
            const data: TagsApiResponse = await res.json();
            if (data.success && Array.isArray(data.data)) {
                tags.value = data.data;
            }
        } catch (err: unknown) {
            if (requestId !== fetchRequestId) return;
            console.error('Failed to fetch tags', err);
            errorCode.value = classifyError(err);
            error.value = extractErrorMessage(err, t('tag.loadFailed', '加载标签失败'));
        } finally {
            if (requestId === fetchRequestId) {
                loadingTags.value = false;
            }
        }
    };

    const createTag = async (name: string, color: string): Promise<Tag | null> => {
        try {
            const res = await authFetch('/api/manage/tags', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, color })
            });
            const data: TagsApiResponse = await res.json();
            if (data.success && data.data && !Array.isArray(data.data)) {
                tags.value.push(data.data);
                // Sort tags alphabetically
                tags.value.sort((a, b) => a.name.localeCompare(b.name));
                return data.data;
            }
            throw new Error(data.error);
        } catch (err: unknown) {
            console.error('Failed to create tag', err);
            throw err;
        }
    };

    const assignTag = async (file_id: string, tag_id: string): Promise<TagsApiResponse> => {
        try {
            const res = await authFetch('/api/manage/tags/assign', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ file_id, tag_id })
            });
            return res.json();
        } catch (err: unknown) {
            console.error('Failed to assign tag', err);
            errorCode.value = classifyError(err);
            error.value = extractErrorMessage(err, t('tag.assignFailed', '分配标签失败'));
            throw err;
        }
    };

    const removeTag = async (file_id: string, tag_id: string): Promise<TagsApiResponse> => {
        try {
            const res = await authFetch('/api/manage/tags/assign', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ file_id, tag_id })
            });
            return res.json();
        } catch (err: unknown) {
            console.error('Failed to remove tag', err);
            errorCode.value = classifyError(err);
            error.value = extractErrorMessage(err, t('tag.removeFailed', '移除标签失败'));
            throw err;
        }
    };

    return {
        tags,
        loadingTags,
        error,
        errorCode,
        fetchTags,
        createTag,
        assignTag,
        removeTag
    };
}
