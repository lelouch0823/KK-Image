<template>
  <div
    class="flex aspect-square animate-pulse flex-col items-center justify-center rounded-lg border-2 border-dashed border-(--color-upload-compressing) bg-(--color-upload-compressing)/5"
  >
    <svg
      class="size-6 animate-spin text-(--color-upload-compressing)"
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle
        class="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        stroke-width="4"
      ></circle>
      <path
        class="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      ></path>
    </svg>
    <span class="mt-1 text-xs font-medium text-(--color-upload-compressing)">{{
      status
    }}</span>
  </div>
</template>

<script setup>
defineProps({
  status: { type: String, required: true },
});
</script>
