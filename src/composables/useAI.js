import { ref } from 'vue';

const isOpen = ref(false);

const context = ref({
    path: '',
    pageTitle: '',
    selectedId: null
});

export function useAI() {
    const toggle = () => {
        console.log('useAI: toggle called, new value:', !isOpen.value);
        isOpen.value = !isOpen.value;
    };

    const open = () => {
        isOpen.value = true;
    };

    const close = () => {
        isOpen.value = false;
    };

    const setContext = (newContext) => {
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
