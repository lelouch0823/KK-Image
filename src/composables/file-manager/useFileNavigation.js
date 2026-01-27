export function useFileNavigation(loadFolderData, clearSelection) {
    const navigateTo = (id) => {
        if (clearSelection) {
            clearSelection();
        }
        loadFolderData(id);
    };

    return {
        navigateTo,
    };
}
