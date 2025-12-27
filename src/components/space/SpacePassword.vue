<template>
    <div class="min-h-screen flex items-center justify-center px-4">
        <div class="w-full max-w-sm">
            <div class="bg-white rounded-2xl border border-[var(--border-color)] shadow-lg p-8">
                <div class="text-center mb-6">
                    <div class="w-14 h-14 mx-auto mb-4 bg-gray-100 rounded-full flex items-center justify-center">
                        <svg class="w-7 h-7 text-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"></path>
                        </svg>
                    </div>
                    <h2 class="text-xl font-semibold text-primary">需要密码</h2>
                    <p class="text-sm text-secondary mt-1">该空间受密码保护</p>
                </div>
                <form @submit.prevent="handleSubmit">
                    <input v-model="password" type="password" placeholder="请输入密码"
                        class="w-full h-12 px-4 text-sm border border-[var(--border-color)] rounded-xl bg-[var(--bg-muted)] focus:bg-white focus:border-primary focus:outline-none mb-4 transition-colors">
                    <button type="submit"
                        class="w-full h-12 bg-primary text-white font-medium rounded-xl hover:bg-gray-800 transition-colors">
                        确认
                    </button>
                </form>
                <p v-if="error" class="text-red-500 text-sm text-center mt-4">{{ error }}</p>
            </div>
        </div>
    </div>
</template>

<script setup>
import { ref } from 'vue';

const props = defineProps({
    error: String,
    onSubmit: Function
});

const password = ref('');

const handleSubmit = () => {
    if (password.value) {
        props.onSubmit(password.value);
    }
};
</script>
