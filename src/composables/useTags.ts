import { ref } from 'vue';
import { useAuth } from '@/composables/useAuth';
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

export function useTags() {
    const { authFetch } = useAuth();
    const error = ref<string | null>(null);
    const errorCode = ref<string | null>(null);
    const fetchTags = async (): Promise<void> => {
        loadingTags.value = true;
        error.value = null;
        errorCode.value = null;
        try {
            const res = await authFetch('/api/manage/tags');
            const data: TagsApiResponse = await res.json();
            if (data.success && Array.isArray(data.data)) {
                tags.value = data.data;
            }
        } catch (err: unknown) {
            console.error('Failed to fetch tags', err);
            errorCode.value = classifyError(err);
            error.value = extractErrorMessage(err, '加载标签失败');
        } finally {
            loadingTags.value = false;
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
        const res = await authFetch('/api/manage/tags/assign', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ file_id, tag_id })
        });
        return res.json();
    };

    const removeTag = async (file_id: string, tag_id: string): Promise<TagsApiResponse> => {
        const res = await authFetch('/api/manage/tags/assign', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ file_id, tag_id })
        });
        return res.json();
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
