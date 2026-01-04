import { ref } from 'vue';

const isOpen = ref(false);

export function useAI() {
    const toggle = () => {
        isOpen.value = !isOpen.value;
    };

    const open = () => {
        isOpen.value = true;
    };

    const close = () => {
        isOpen.value = false;
    };

    return {
        isOpen,
        toggle,
        open,
        close
    };
}
