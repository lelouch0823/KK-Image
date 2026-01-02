<template>
  <Teleport to="body">
    <div class="fixed top-4 right-4 z-[1000] flex flex-col gap-2 pointer-events-none">
      <transition-group name="slide-up">
        <div v-for="toast in toasts" :key="toast.id" 
          class="pointer-events-auto flex items-center w-full max-w-xs p-4 bg-[var(--bg-card)] rounded-lg shadow-xl border border-[var(--border-color)]" 
          role="alert">
          <div class="inline-flex items-center justify-center flex-shrink-0 w-8 h-8 rounded-lg" :class="{
            'text-[var(--color-success-text)] bg-[var(--color-success-bg)]': toast.type === 'success',
            'text-[var(--color-danger-text)] bg-[var(--color-danger-bg)]': toast.type === 'error',
            'text-[var(--color-warning-text)] bg-[var(--color-warning-bg)]': toast.type === 'warning'
          }">
              <!-- Success Icon -->
              <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20" v-if="toast.type === 'success'">
                <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"></path>
              </svg>
              <!-- Error Icon -->
              <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20" v-else-if="toast.type === 'error'">
                <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"></path>
              </svg>
               <!-- Warning Icon (Exclamation) -->
               <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20" v-else-if="toast.type === 'warning'">
                  <path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd"></path>
               </svg>
          </div>
          <div class="ml-3 text-sm font-normal text-[var(--text-main)]">{{ toast.message }}</div>
          <button @click="removeToast(toast.id)" type="button" class="ml-auto -mx-1.5 -my-1.5 bg-transparent text-[var(--text-secondary)] hover:text-[var(--text-main)] rounded-lg focus:ring-2 focus:ring-[var(--border-color)] p-1.5 hover:bg-[var(--bg-hover)] inline-flex h-8 w-8">
              <span class="sr-only">{{ t('common.close') }}</span>
              <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"></path></svg>
          </button>
        </div>
      </transition-group>
    </div>
  </Teleport>
</template>

<script setup>
import { useToast } from '@/composables/useToast';
import { useI18n } from '@/composables/useI18n';

const { toasts, removeToast } = useToast();
const { t } = useI18n();
</script>
