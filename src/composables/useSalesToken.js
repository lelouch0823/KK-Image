import { computed } from 'vue';

/**
 * Composable to extract sales token from URL
 * Pattern: /sales/:token
 */
export function useSalesToken() {
  const token = computed(() => {
    const match = window.location.pathname.match(/\/sales\/([^/]+)/);
    return match ? match[1] : null;
  });

  return {
    token,
  };
}
