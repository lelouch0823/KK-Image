import { ref } from 'vue';

interface AIContext {
    path: string;
    pageTitle: string;
    selectedId: any;
    selectedType: any;
}

const isOpen = ref<boolean>(false);

const context = ref<AIContext>({
    path: '',
    pageTitle: '',
    selectedId: null,
    selectedType: null,
});

export function useAI() {
    const toggle = (): void => {
        isOpen.value = !isOpen.value;
    };

    const open = (): void => {
        isOpen.value = true;
    };

    const close = (): void => {
        isOpen.value = false;
    };

    const setContext = (newContext: Partial<AIContext>): void => {
        context.value = { ...context.value, ...newContext };
    };

    return {
        isOpen,
        toggle,
        open,
        close,
        context,
        setContext
    };
}
