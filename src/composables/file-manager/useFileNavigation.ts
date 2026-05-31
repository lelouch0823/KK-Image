export function useFileNavigation(loadFolderData: (id: string | null) => void, clearSelection?: () => void) {
    const navigateTo = (id: string | null): void => {
        if (clearSelection) {
            clearSelection();
        }
        loadFolderData(id);
    };

    return {
        navigateTo,
    };
}
