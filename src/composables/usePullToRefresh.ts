/**
 * Pull to Refresh Composable
 * Handles touch events to implement pull-to-refresh functionality.
 *
 * @module composables/usePullToRefresh
 */
import { ref, type Ref } from 'vue';

interface PullToRefreshOptions {
    threshold?: number;
    containerRef?: Ref<HTMLElement | null> | null;
}

export function usePullToRefresh(onRefresh: () => Promise<void>, options: PullToRefreshOptions = {}) {
    const { threshold = 100, containerRef = null } = options;

    const isPulling = ref<boolean>(false);
    const pullDistance = ref<number>(0);
    const startY = ref<number>(0);
    const isDragging = ref<boolean>(false);

    const handleTouchStart = (e: TouchEvent): void => {
        // Only enable if at the top of the page/container
        const scrollTop = containerRef?.value ? containerRef.value.scrollTop : window.scrollY;
        if (scrollTop > 0) return;

        startY.value = e.touches[0].clientY;
        isDragging.value = true;
    };

    const handleTouchMove = (e: TouchEvent): void => {
        if (!isDragging.value) return;

        const currentY = e.touches[0].clientY;
        const distance = currentY - startY.value;

        // Only allow pulling down
        if (distance > 0) {
            // Add resistance
            pullDistance.value = Math.pow(distance, 0.8);
            // Prevent default scrolling if pulling
            if (pullDistance.value > 10 && e.cancelable) {
                e.preventDefault();
            }
        } else {
            pullDistance.value = 0;
        }
    };

    const handleTouchEnd = async (): Promise<void> => {
        if (!isDragging.value) return;
        isDragging.value = false;

        if (pullDistance.value > threshold) {
            isPulling.value = true;
            pullDistance.value = threshold; // Snap to threshold
            try {
                await onRefresh();
            } finally {
                isPulling.value = false;
                pullDistance.value = 0;
            }
        } else {
            pullDistance.value = 0;
        }
    };

    // Lifecycle hooks to attach/detach listeners
    // Note: It's often better to attach these directly to the element in the component template
    // for better control, but exposing handlers allows for flexibility.

    return {
        isPulling,
        pullDistance,
        handleTouchStart,
        handleTouchMove,
        handleTouchEnd,
    };
}
