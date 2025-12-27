<template>
  <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50" @click.self="$emit('close')">
    <div class="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 overflow-hidden">
      <!-- Header -->
      <div class="flex items-center justify-between px-6 py-4 border-b border-gray-100">
        <h2 class="text-lg font-semibold text-primary">创建共享空间</h2>
        <button @click="$emit('close')" class="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
          </svg>
        </button>
      </div>

      <!-- Form -->
      <form @submit.prevent="handleSubmit" class="p-6 space-y-4">
        <!-- 模版选择 -->
        <div>
          <label class="block text-sm font-medium text-primary mb-2">选择模版</label>
          <div class="grid grid-cols-2 gap-2">
            <button v-for="t in templates" :key="t.key" type="button"
              @click="form.template = t.key"
              class="flex items-center gap-2 p-3 border rounded-lg text-left transition-all"
              :class="form.template === t.key ? 'border-primary bg-gray-50' : 'border-gray-200 hover:border-gray-300'">
              <span v-html="t.icon" class="w-5 h-5 text-gray-500 shrink-0"></span>
              <div>
                <div class="text-sm font-medium text-primary">{{ t.label }}</div>
                <div class="text-xs text-secondary">{{ t.desc }}</div>
              </div>
            </button>
          </div>
        </div>

        <!-- 通用字段: 描述 (仅非商品模版显示，商品模版在详情里填) -->
        <div v-if="form.template !== 'product'">
          <label class="block text-sm font-medium text-primary mb-1">描述</label>
          <textarea v-model="form.description" rows="2"
            class="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:border-primary focus:ring-1 focus:ring-primary outline-none resize-none"
            placeholder="可选，简要描述空间内容"></textarea>
        </div>

        <!-- 动态表单: 商品模版 -->
        <div v-if="form.template === 'product'" class="space-y-4 pt-2 border-t border-gray-100">
           <!-- 商品名称 (覆盖通用名称) -->
          <div>
            <label class="block text-sm font-medium text-primary mb-1">商品名称 *</label>
            <input v-model="form.name" type="text" required
              class="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:border-primary focus:ring-1 focus:ring-primary outline-none"
              placeholder="如：Nike Air Force 1">
          </div>
          
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-sm font-medium text-primary mb-1">品牌</label>
              <input v-model="form.templateData.brand" type="text"
                class="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:border-primary outline-none"
                placeholder="如：Nike">
            </div>
            <div>
              <label class="block text-sm font-medium text-primary mb-1">系列</label>
              <input v-model="form.templateData.series" type="text"
                class="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:border-primary outline-none"
                placeholder="如：Air Force">
            </div>
          </div>
          
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-sm font-medium text-primary mb-1">价格</label>
              <div class="relative">
                <span class="absolute left-3 top-2.5 text-gray-500">¥</span>
                <input v-model="form.templateData.price" type="number" step="0.01"
                  class="w-full pl-8 pr-4 py-2.5 border border-gray-200 rounded-lg focus:border-primary outline-none"
                  placeholder="0.00">
              </div>
            </div>
            <div>
              <label class="block text-sm font-medium text-primary mb-1">材质</label>
              <input v-model="form.templateData.material" type="text"
                class="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:border-primary outline-none"
                placeholder="如：真皮">
            </div>
          </div>
        </div>

        <!-- 动态表单: 通用模版 -->
        <div v-else>
           <!-- 空间名称 -->
          <div>
            <label class="block text-sm font-medium text-primary mb-1">空间名称 *</label>
            <input v-model="form.name" type="text" required
              class="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:border-primary focus:ring-1 focus:ring-primary outline-none"
              placeholder="如：2025春季新品资料">
          </div>
        </div>

        <!-- 提交按钮 -->
        <button type="submit" :disabled="submitting"
          class="w-full py-3 bg-primary text-white font-medium rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-50 mt-4">
          {{ submitting ? '创建中...' : (form.template === 'product' ? '创建商品' : '创建空间') }}
        </button>
      </form>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import { useSpaces } from '@/composables/useSpaces';

const emit = defineEmits(['close', 'created']);

const { createSpace } = useSpaces();

const form = ref({
  name: '',
  description: '',
  template: 'gallery',
  templateData: {
    brand: '',
    series: '',
    price: '',
    material: ''
  }
});

const submitting = ref(false);

const templates = [
  { key: 'gallery', label: '画廊', desc: '瀑布流图片展示', icon: '<svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>' },
  { key: 'product', label: '商品', desc: '电商风格详情页', icon: '<svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"></path></svg>' },
  { key: 'collection', label: '合集', desc: '管理子空间归档', icon: '<svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"></path></svg>' },
  { key: 'document', label: '文档库', desc: '文件列表下载', icon: '<svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>' },
  { key: 'portfolio', label: '作品集', desc: '大图轮播展示', icon: '<svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"></path></svg>' }
];

const handleSubmit = async () => {
  if (!form.value.name.trim()) return;
  
  submitting.value = true;
  const result = await createSpace(form.value);
  submitting.value = false;
  
  if (result) {
    emit('created', result);
  }
};
</script>
