import { ref } from 'vue';
import { useAuth } from '@/composables/useAuth';

const tags = ref([]);
const loadingTags = ref(false);

export function useTags() {
    const { authFetch } = useAuth();
    const fetchTags = async () => {
        loadingTags.value = true;
        try {
            const res = await authFetch('/api/manage/tags');
            const data = await res.json();
            if (data.success) {
                tags.value = data.tags;
            }
        } catch (err) {
            console.error('Failed to fetch tags', err);
        } finally {
            loadingTags.value = false;
        }
    };

    const createTag = async (name, color) => {
        try {
            const res = await authFetch('/api/manage/tags', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, color })
            });
            const data = await res.json();
            if (data.success) {
                tags.value.push(data.tag);
                // Sort tags alphabetically
                tags.value.sort((a, b) => a.name.localeCompare(b.name));
                return data.tag;
            }
            throw new Error(data.error);
        } catch (err) {
            console.error('Failed to create tag', err);
            throw err;
        }
    };

    const assignTag = async (file_id, tag_id) => {
        const res = await authFetch('/api/manage/tags/assign', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ file_id, tag_id })
        });
        return res.json();
    };

    const removeTag = async (file_id, tag_id) => {
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
        fetchTags,
        createTag,
        assignTag,
        removeTag
    };
}
