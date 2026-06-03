import { computed, type ComputedRef } from 'vue';
import { useRoute } from 'vue-router';

/**
 * Composable to extract sales token from route params
 * Pattern: /sales/:token
 */
export function useSalesToken(): { token: ComputedRef<string | null> } {
  const route = useRoute();

  const token = computed((): string | null => {
    const param = route.params.token;
    if (Array.isArray(param)) {
      return param[0] ?? null;
    }
    return param ?? null;
  });

  return {
    token,
  };
}
