<template>
  <div class="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
    <div class="text-center mb-12">
        <div class="w-16 h-16 mx-auto mb-4 bg-blue-50 text-blue-500 rounded-2xl flex items-center justify-center">
             <svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"></path>
             </svg>
        </div>
        <h1 class="text-2xl font-bold text-primary">{{ space.name }}</h1>
        <p class="text-secondary mt-2">{{ space.description || '暂无描述' }}</p>
    </div>

    <!-- Subspaces Grid -->
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        <a v-for="sub in space.subspaces" :key="sub.id" :href="`/space/${sub.shareToken}`"
           class="bg-white border border-gray-100 rounded-xl p-6 hover:shadow-lg transition-all group flex items-start gap-4">
           <div class="w-12 h-12 bg-gray-50 rounded-lg flex items-center justify-center shrink-0 group-hover:bg-primary group-hover:text-white transition-colors">
               <svg class="w-6 h-6 text-gray-400 group-hover:text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                   <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"></path>
               </svg>
           </div>
           <div>
               <h3 class="font-semibold text-primary group-hover:text-primary">{{ sub.name }}</h3>
               <p class="text-xs text-secondary mt-1">{{ sub.fileCount }} items</p>
           </div>
           <div class="ml-auto">
                <svg class="w-5 h-5 text-gray-300 group-hover:text-primary transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path>
                </svg>
           </div>
        </a>
    </div>
    
    <!-- Empty State -->
    <div v-if="!space.subspaces || space.subspaces.length === 0" class="text-center py-12 text-secondary bg-gray-50 rounded-xl border border-dashed border-gray-200">
        <p>此合集暂无子空间</p>
    </div>
  </div>
</template>

<script setup>
const props = defineProps({
  space: { type: Object, required: true }
});
</script>
