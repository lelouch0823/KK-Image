import { ref, type Ref } from 'vue';

export function useFileDrag(currentFolder: Ref<any>, onFilesDropped: (files: File[]) => void) {
    const isDragging = ref<boolean>(false);
    const dragCounter = ref<number>(0);

    const onDragEnter = (e: DragEvent): void => {
        e.preventDefault();
        dragCounter.value++;
        if (currentFolder.value) {
            isDragging.value = true;
        }
    };

    const onDragLeave = (e: DragEvent): void => {
        e.preventDefault();
        dragCounter.value--;
        if (dragCounter.value === 0) {
            isDragging.value = false;
        }
    };

    const onDragOver = (e: DragEvent): void => {
        e.preventDefault();
    };

    const onDrop = (e: DragEvent): void => {
        e.preventDefault();
        isDragging.value = false;
        dragCounter.value = 0;

        if (!currentFolder.value) return;

        if (e.dataTransfer?.files && e.dataTransfer.files.length > 0) {
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
