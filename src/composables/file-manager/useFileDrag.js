import { ref } from 'vue';

export function useFileDrag(currentFolder, onFilesDropped) {
    const isDragging = ref(false);
    const dragCounter = ref(0);

    const onDragEnter = (e) => {
        e.preventDefault();
        dragCounter.value++;
        if (currentFolder.value) {
            isDragging.value = true;
        }
    };

    const onDragLeave = (e) => {
        e.preventDefault();
        dragCounter.value--;
        if (dragCounter.value === 0) {
            isDragging.value = false;
        }
    };

    const onDragOver = (e) => {
        e.preventDefault();
    };

    const onDrop = (e) => {
        e.preventDefault();
        isDragging.value = false;
        dragCounter.value = 0;

        if (!currentFolder.value) return;

        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            onFilesDropped(Array.from(e.dataTransfer.files));
        }
    };

    return {
        isDragging,
        onDragEnter,
        onDragLeave,
        onDragOver,
        onDrop,
    };
}
