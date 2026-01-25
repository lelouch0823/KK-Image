<template>
  <div class="mx-auto w-full max-w-[1600px] space-y-6 p-6 lg:p-8">
    <!-- Dynamic Header with Transition -->
    <div class="flex min-h-[80px] flex-col gap-2">
      <Transition
        enter-active-class="transition duration-500 ease-out"
        enter-from-class="opacity-0 translate-y-2"
        enter-to-class="opacity-100 translate-y-0"
        leave-active-class="absolute transition duration-300 ease-in"
        leave-from-class="opacity-100 translate-y-0"
        leave-to-class="opacity-0 -translate-y-2"
      >
        <div :key="title" class="w-full">
          <h1 class="text-primary text-3xl font-bold tracking-tight">{{ title }}</h1>
          <p class="text-secondary mt-2 max-w-2xl text-base">{{ description }}</p>
        </div>
      </Transition>
    </div>

    <!-- Main Content Grid -->
    <div class="grid grid-cols-1 gap-8 lg:grid-cols-12 lg:gap-12">
      <!-- Sidebar -->
      <aside class="lg:col-span-3 xl:col-span-2">
        <div class="sticky top-6">
          <slot name="sidebar" />
        </div>
      </aside>

      <!-- Content Area -->
      <main class="space-y-6 lg:col-span-9 xl:col-span-10">
        <slot />
      </main>
    </div>
  </div>
</template>

<script setup>
defineProps({
  title: {
    type: String,
    required: true,
  },
  description: {
    type: String,
    required: true,
  },
});
</script>
