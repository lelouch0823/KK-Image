<template>
  <!-- 添加到组件根部的外层包装，不限制拖拽溢出，让窗口可以全屏移动 -->
  <div class="pointer-events-none fixed inset-0 z-9999 overflow-hidden">
    <transition
      enter-active-class="transition duration-300 ease-out"
      enter-from-class="translate-y-4 transform scale-95 opacity-0"
      enter-to-class="translate-y-0 transform scale-100 opacity-100"
      leave-active-class="transition duration-200 ease-in"
      leave-from-class="translate-y-0 transform scale-100 opacity-100"
      leave-to-class="translate-y-4 transform scale-95 opacity-0"
    >
      <div
        v-if="isOpen"
        ref="widgetEl"
        :style="isMobile ? undefined : {
          left: `${x}px`,
          top: `${y}px`,
          width: `${width}px`,
          height: `${height}px`,
        }"
        :class="[
          'pointer-events-auto flex flex-col overflow-hidden bg-(--bg-card) shadow-2xl backdrop-blur-xl transition-transform',
          isMobile 
            ? 'fixed inset-0 z-10000 rounded-none border-0' 
            : 'border-border absolute min-h-[300px] max-w-[calc(100vw-2rem)] min-w-[320px] rounded-2xl border'
        ]"
      >
        <!-- Header -->
        <div 
          ref="dragHandleEl" 
          class="bg-primary flex items-center justify-between p-4 text-(--text-inverse) transition-colors"
          :class="isMobile ? '' : 'hover:bg-primary/90 cursor-move'"
        >
          <div class="flex items-center gap-3">
            <div class="flex size-8 items-center justify-center rounded-lg bg-white/20">
              <AppIcon name="bolt" class="size-5" />
            </div>
            <div>
              <h3 class="text-sm font-bold">{{ t('ai.assistant') }}</h3>
              <p class="text-[10px] opacity-70">{{ t('ai.subtitle') }}</p>
            </div>
          </div>
          <div class="flex items-center gap-2">
            <button
              v-if="messages.length > 1"
              :title="t('ai.clear')"
              class="rounded-lg p-1.5 transition-colors hover:bg-white/10"
              @click="clearHistory"
            >
              <AppIcon name="trash" class="size-5" />
            </button>
            <button
              :title="t('common.close')"
              class="rounded-lg p-1.5 transition-colors hover:bg-white/10"
              @click="close"
            >
              <AppIcon name="x-mark" class="size-5" />
            </button>
          </div>
        </div>

        <!-- Messages Area -->
        <div ref="messageContainer" class="flex-1 space-y-4 overflow-y-auto p-4">
          <ChatMessage
            v-for="(msg, index) in messages"
            :key="index"
            :message="msg"
            :is-thinking="msg.role === 'assistant' && index === messages.length - 1 && (isThinking || isAwaitingAssistant)"
            :tool-status="msg.role === 'assistant' && index === messages.length - 1 ? toolStatus : ''"
            :show-report-button="shouldShowReportButtonForMessage(msg, index)"
            :is-generating-report="isGeneratingReport"
            @generate-report="generateReport"
          />
        </div>

        <!-- Input Area -->
        <div 
          class="border-t border-(--border-color) bg-(--bg-card) px-4 pt-1 pb-4 transition-colors duration-200"
          :class="isImageHovering ? 'bg-primary/5 border-primary/30' : ''"
          @dragover.prevent="isImageHovering = true"
          @dragleave.prevent="isImageHovering = false"
          @drop.prevent="onDrop"
        >
          <AISuggestions 
            class="mb-2" 
            :suggestions="suggestions" 
            @select="handleSuggestion" 
          />
          
          <!-- Image Attachment Preview -->
          <div v-if="attachedImage" class="relative mb-3 inline-block">
            <div class="flex size-16  items-center justify-center overflow-hidden rounded-xl border border-(--border-color) bg-(--bg-muted) shadow-sm">
              <img :src="attachedImage" alt="Attached" class="max-h-full max-w-full object-cover" />
            </div>
            <button 
              type="button"
              class="absolute -top-2 -right-2 cursor-pointer rounded-full bg-red-500 p-0.5 text-white shadow-md transition-colors hover:bg-red-600"
              @click="attachedImage = null"
            >
              <AppIcon name="x-mark" class="size-3" />
            </button>
          </div>

          <form
            class="relative flex items-end gap-2"
            @submit.prevent="sendMessage"
          >
            <input 
              ref="fileInput" 
              type="file" 
              class="hidden" 
              accept="image/*" 
              @change="onFileSelect" 
            />
            <button
              :disabled="isStreamingLoading"
              type="button"
              :title="t('ai.uploadImage', '上传图片')"
              class="hover:text-primary hover:bg-(--bg-muted) mb-0.5 shrink-0 cursor-pointer rounded-xl p-2.5 text-(--text-secondary) transition-colors disabled:opacity-30"
              @click="triggerFileInput"
            >
              <AppIcon name="photo" class="size-5" />
            </button>
            <div class="relative flex-1">
              <input
                v-model="userInput"
                :disabled="isStreamingLoading"
                type="text"
                :placeholder="t('ai.placeholder')"
                class="focus:ring-primary/20 focus:ring-2 w-full rounded-xl border-none bg-(--bg-muted) py-3 pr-12 pl-4 text-sm transition-all dark:bg-white/5"
                @paste="onPaste"
              />
              <button
                :disabled="(!userInput.trim() && !attachedImage) || isStreamingLoading"
                type="submit"
                class="text-primary absolute top-1.5 right-2 cursor-pointer rounded-lg p-1.5 transition-all hover:bg-primary/10 disabled:opacity-30"
              >
                <AppIcon name="paper-airplane" class="size-5" />
              </button>
            </div>
          </form>
        </div>

        <!-- Resize Handle (Desktop Only) -->
        <div 
          v-if="!isMobile"
          class="absolute right-0 bottom-0 z-10 flex size-6 cursor-se-resize items-end justify-end p-1.5 text-(--text-secondary) opacity-50 transition-opacity hover:opacity-100"
          @mousedown.prevent="startResize"
        >
          <svg viewBox="0 0 12 12" class="size-2.5">
            <path d="M10 10H12V12H10V10ZM6 10H8V12H6V10ZM10 6H12V8H10V6ZM2 10H4V12H2V10ZM6 6H8V8H6V6ZM10 2H12V4H10V2Z" fill="currentColor"/>
          </svg>
        </div>
      </div>
    </transition>
  </div>
</template>

<script setup>
import { ref, nextTick, watch, computed, onUnmounted } from 'vue';
import { useRoute } from 'vue-router';
import { useDraggable, useStorage, useWindowSize } from '@vueuse/core';
import { API as API_URLS } from '@/utils/constants';
import { renderMarkdown, fixIncompleteMarkdown } from '@/utils/ai-markdown';
import ChatMessage from '@/components/common/ai/ChatMessage.vue';
import AISuggestions from '@/components/common/ai/AISuggestions.vue';
import AppIcon from '@/components/ui/AppIcon.vue';
import { useI18n } from '@/composables/useI18n';
import { useAI } from '@/composables/useAI';
import { useAIStream } from '@/composables/useAIStream';
import { useImageCompression } from '@/composables/useImageCompression';
import { useToast } from '@/composables/useToast';
import { useRequestAdapters } from '@/composables/useRequestAdapters';
import { throttle } from '@/utils/performance';
import { inferCurrentView, inferAIEntityContext } from '@/components/common/ai/context-inference';

const { isOpen, close, context, setContext } = useAI();
const { t } = useI18n();
const { addToast } = useToast();
const { requestAuth } = useRequestAdapters();
const route = useRoute();
const { width: windowWidth, height: windowHeight } = useWindowSize();
const isMobile = computed(() => windowWidth.value <= 768);

// 窗口尺寸与位置状态 (持久化)
// 默认右上角对齐 (避开顶栏):
const initialWidth = 420;
const initialHeight = 600;
// 右边距24px
const defaultX = Math.max(0, windowWidth.value - initialWidth - 24); 
// 距离顶部 80px
const defaultY = 80; 

const width = useStorage('ai-chat-width', initialWidth);
const height = useStorage('ai-chat-height', initialHeight);
const storedX = useStorage('ai-chat-x', defaultX);
const storedY = useStorage('ai-chat-y', defaultY);

const widgetEl = ref(null);
const dragHandleEl = ref(null);

const { x, y } = useDraggable(widgetEl, {
  initialValue: { x: storedX.value, y: storedY.value },
  handle: dragHandleEl,
  preventDefault: false,
});

watch([x, y], ([newX, newY]) => {
  storedX.value = newX;
  storedY.value = newY;
});

// 手动实现缩放大小逻辑
let isResizing = false;
let startX = 0;
let startY = 0;
let startWidth = 0;
let startHeight = 0;

const startResize = (e) => {
  isResizing = true;
  startX = e.clientX;
  startY = e.clientY;
  startWidth = width.value;
  startHeight = height.value;
  
  document.addEventListener('mousemove', onResize);
  document.addEventListener('mouseup', stopResize);
  // 防止拖动时选中文本
  document.body.style.userSelect = 'none';
};

const onResize = (e) => {
  if (!isResizing) return;
  requestAnimationFrame(() => {
    // 最小限制并防溢出
    const newW = Math.max(320, startWidth + (e.clientX - startX));
    const newH = Math.max(300, startHeight + (e.clientY - startY));
    width.value = Math.min(newW, windowWidth.value - x.value - 24);
    height.value = Math.min(newH, windowHeight.value - y.value - 24);
  });
};

const stopResize = () => {
  isResizing = false;
  document.removeEventListener('mousemove', onResize);
  document.removeEventListener('mouseup', stopResize);
  document.body.style.userSelect = '';
};

// 安全清理：当组件被销毁但还在拖拽时
onUnmounted(stopResize);

// 监听窗口打开以及大小变化限制溢出
watch([windowWidth, windowHeight, isOpen], ([vw, vh, open]) => {
  if (open) {
    if (x.value + width.value > vw) x.value = Math.max(0, vw - width.value - 24);
    if (y.value + height.value > vh) y.value = Math.max(0, vh - height.value - 24);
  }
}, { immediate: true });

// 从路由计算当前视图和标题
const currentView = computed(() => inferCurrentView(route.path));
const viewTitle = computed(() => route.meta?.title || document.title);
const currentEntityContext = computed(() => inferAIEntityContext({
  view: currentView.value,
  params: route.params,
  query: route.query,
}));

const userInput = ref('');
const messageContainer = ref(null);

const attachedImage = ref(null);
const isImageHovering = ref(false);
const fileInput = ref(null);
const { compressImageToDataUrl } = useImageCompression({
  maxSizeMB: 1.2,
  maxWidthOrHeight: 1600,
  initialQuality: 0.9,
  fileType: 'image/jpeg',
  applyWatermark: false,
});

const createWelcomeMessage = () => ({
  role: 'assistant',
  content: t('ai.welcome'),
  html: renderMarkdown(t('ai.welcome'))
});

const normalizeUserContentParts = (content) => {
  if (!Array.isArray(content)) return null;
  const parts = content.filter((part) => {
    if (part?.type === 'text' && typeof part.text === 'string') return true;
    if (part?.type === 'image_url' && typeof part.image_url?.url === 'string') return true;
    return false;
  });
  return parts.length > 0 ? parts : null;
};

const normalizeStoredMessages = (raw) => {
  if (!Array.isArray(raw)) return [createWelcomeMessage()];
  const normalized = raw
    .map((msg) => {
      if (msg?.role === 'assistant' && typeof msg.content === 'string') {
        return {
          role: 'assistant',
          content: msg.content,
          html: typeof msg.html === 'string' && msg.html ? msg.html : renderMarkdown(msg.content),
        };
      }
      if (msg?.role === 'user') {
        const userParts = normalizeUserContentParts(msg.content);
        if (!userParts) return null;
        return {
          role: 'user',
          content: userParts,
          html: '',
        };
      }
      return null;
    })
    .filter(Boolean);
  return normalized.length > 0 ? normalized : [createWelcomeMessage()];
};

const handleFile = async (file) => {
  if (!file || (!file.type.startsWith('image/') && !file.name?.match(/\.(jpg|jpeg|png|webp|gif)$/i))) {
    addToast({ message: t('ai.onlyImages', '仅支持图片格式文件'), type: 'error' });
    return;
  }
  try {
    const result = await compressImageToDataUrl(file);
    attachedImage.value = result.dataUrl;
  } catch (err) {
    console.error('Image compression failed:', err);
    addToast({ message: t('ai.imageError', '处理图片失败'), type: 'error' });
  }
};

const triggerFileInput = () => fileInput.value?.click();
const onFileSelect = (e) => {
  const file = e.target.files?.[0];
  if (file) handleFile(file);
  if (e.target) e.target.value = '';
};
const onPaste = (e) => {
  const items = e.clipboardData?.items;
  if (!items) return;
  for (let i = 0; i < items.length; i++) {
    if (items[i].type.startsWith('image/')) {
      const file = items[i].getAsFile();
      if (file) {
        handleFile(file);
        e.preventDefault();
        break;
      }
    }
  }
};
const onDrop = (e) => {
  isImageHovering.value = false;
  const file = e.dataTransfer?.files?.[0];
  if (file) handleFile(file);
};

// 自动感知上下文
watch(
  [currentView, currentEntityContext],
  ([view, entity]) => {
    setContext({
      path: '/' + view,
      pageTitle: viewTitle.value,
      selectedId: entity.selectedId,
      selectedType: entity.selectedType,
    });
  },
  { immediate: true }
);

// 主动建议逻辑
const suggestions = computed(() => {
  const view = currentView.value;
  const sug = (key) => t(`ai.suggestions.${key}`);
  
  if (view === 'dashboard') {
    return [sug('dailyReport'), sug('monthlySalesRanking'), sug('systemStatus')];
  }
  if (view === 'orders' || view === 'order-detail') {
    return [sug('pendingOrders'), sug('todayNewOrders'), sug('weeklySalesTrend')];
  }
  if (view === 'customers') {
    return [sug('weeklyNewCustomers'), sug('customerCount')];
  }
  if (view === 'spaces' || view === 'space-detail') {
    return [sug('spaceUsage'), sug('recentActiveSpaces'), sug('downloadTop10')];
  }
  if (view === 'files') {
    return [sug('storageUsage'), sug('largeFileAnalysis'), sug('fileTypeDistribution')];
  }
  if (view === 'sales' || view === 'salespersons') {
    return [sug('myDailyPerformance'), sug('monthlyCommission')];
  }
  return [sug('dailyReport'), sug('pendingOrders'), sug('systemStatus')];
});

const handleSuggestion = (text) => {
  userInput.value = text;
  sendMessage();
};

const { 
  stream: startAIStream,
  fullContent,
  displayedContent: streamContent, 
  isThinking,
  isLoading: isStreamingLoading,
  isStreaming: isAIStreaming,
  toolStatus,
} = useAIStream();

const isGeneratingReport = ref(false);
const isAwaitingAssistant = ref(false);
const awaitingSince = ref(0);
const shouldAutoFollow = ref(true);

// 判断特定消息是否应显示报告按钮
const shouldShowReportButtonForMessage = (msg, index) => {
  // 正在流式传输时不显示
  if (isAIStreaming.value || isStreamingLoading.value) return false;
  // 必须是 assistant 消息
  if (msg.role !== 'assistant') return false;
  // 必须是最后一条 assistant 消息（避免重复显示）
  const lastAssistantIndex = messages.value.map((m, i) => m.role === 'assistant' ? i : -1).filter(i => i >= 0).pop();
  if (index !== lastAssistantIndex) return false;
  // 必须包含报告标记
  return msg.content?.includes('[REPORT_AVAILABLE]');
};

// SOTA: Throttled Markdown rendering - use fullContent for proper parsing
const throttledRender = throttle((content, targetMsg) => {
  if (targetMsg) {
    targetMsg.html = renderMarkdown(content);
    scrollToBottom();
  }
}, 100);

// Listen for streaming content updates
// Use fullContent for markdown rendering (complete text), streamContent for display
watch([fullContent, streamContent], ([full, displayed]) => {
  if (messages.value.length > 0) {
    const lastMsg = messages.value[messages.value.length - 1];
    if (lastMsg.role === 'assistant') {
      lastMsg.content = displayed; // For typewriter display
      // Use fullContent for markdown rendering (contains complete text)
      throttledRender(full, lastMsg);
    }
  }
});

const messages = useStorage('ai-chat-messages-v2', [createWelcomeMessage()]);
messages.value = normalizeStoredMessages(messages.value);

// SOTA: 流式输出彻底结束后进行一次性的词法补全纠错与数据落地定型
watch(isAIStreaming, (streaming, oldStreaming) => {
  if (oldStreaming === true && streaming === false && messages.value.length > 0) {
    const lastMsg = messages.value[messages.value.length - 1];
    if (lastMsg.role === 'assistant' && fullContent.value) {
      const fixedContent = fixIncompleteMarkdown(fullContent.value);
      // 永久保存纠正后的源码防止历史记录损坏
      lastMsg.content = fixedContent; 
      // 强制执行最后一次满血渲染
      lastMsg.html = renderMarkdown(fixedContent);
      scrollToBottom();
    }
  }
});

const scrollToBottom = async () => {
  await nextTick();
  if (messageContainer.value) {
    messageContainer.value.scrollTop = messageContainer.value.scrollHeight;
  }
};

const forceFollowBottom = () => {
  if (!messageContainer.value) return;
  requestAnimationFrame(() => {
    if (!messageContainer.value) return;
    messageContainer.value.scrollTop = messageContainer.value.scrollHeight;
  });
};

watch(isOpen, async (val) => {
  if (val) {
    await scrollToBottom();
  }
});

watch([streamContent, fullContent, toolStatus, isAIStreaming, isAwaitingAssistant], () => {
  if (!shouldAutoFollow.value) return;
  if (!isAIStreaming.value && !isAwaitingAssistant.value) return;
  forceFollowBottom();
});

const clearHistory = () => {
  if (confirm(t('ai.clearConfirm'))) {
    messages.value = [createWelcomeMessage()];
  }
};

const sendMessage = async () => {
  if ((!userInput.value.trim() && !attachedImage.value) || isStreamingLoading.value || isAIStreaming.value) return;

  const userQuery = userInput.value.trim();
  const currentImage = attachedImage.value;
  const userParts = [];
  if (userQuery) {
    userParts.push({ type: 'text', text: userQuery });
  } else if (currentImage) {
    userParts.push({ type: 'text', text: t('ai.analyzeImage', '请分析这张图片') });
  }
  if (currentImage) {
    userParts.push({ type: 'image_url', image_url: { url: currentImage } });
  }

  messages.value.push({ role: 'user', content: userParts, html: '' });
  userInput.value = '';
  attachedImage.value = null;
  // loading state managed by useAIStream
  toolStatus.value = '';
  isAwaitingAssistant.value = true;
  awaitingSince.value = Date.now();
  shouldAutoFollow.value = true;
  await scrollToBottom();

  // Add placeholder for assistant response
  messages.value.push({ role: 'assistant', content: '', html: '' });
  
  const historyToSend = messages.value.slice(-8, -1).map(({ role, content }) => ({ role, content }));

  try {
    await startAIStream({
      messages: historyToSend,
      context: context.value
    });

    const lastMsg = messages.value[messages.value.length - 1];
    if (lastMsg && lastMsg.role === 'assistant') {
      // Final render with complete fullContent for proper markdown parsing
      let finalAssistantContent = fullContent.value;
      if (typeof finalAssistantContent === 'string' && finalAssistantContent.includes('[IMAGE_UNSUPPORTED]')) {
        addToast({ message: t('ai.modelImageNotSupported', '当前模型不支持识别图片，请移除图片或切换模型。'), type: 'error' });
        finalAssistantContent = finalAssistantContent.replace('[IMAGE_UNSUPPORTED]', '').trim();
      }

      lastMsg.content = finalAssistantContent;
      lastMsg.html = renderMarkdown(finalAssistantContent);
      if (!lastMsg.content) {
        messages.value.pop();
      }
    }
  } catch (_err) {
    // Error is handled in useAIStream (toast)
    const lastMsg = messages.value[messages.value.length - 1];
    if (lastMsg?.role === 'assistant' && !lastMsg.content && !lastMsg.html) {
      messages.value.pop();
    }
    if (_err?.isImageError) {
      const lastUserMessage = [...messages.value].reverse().find((item) => item?.role === 'user');
      const userPartsInHistory = normalizeUserContentParts(lastUserMessage?.content);
      if (lastUserMessage && userPartsInHistory) {
        lastUserMessage.content = userPartsInHistory.filter((part) => part.type !== 'image_url');
      }
    }
  } finally {
    const elapsed = Date.now() - awaitingSince.value;
    const minVisibleMs = 280;
    if (elapsed < minVisibleMs) {
      await new Promise((resolve) => setTimeout(resolve, minVisibleMs - elapsed));
    }
    isAwaitingAssistant.value = false;
    await scrollToBottom();
  }
};

/**
 * 生成并打开完整 HTML 报告
 */
const generateReport = async () => {
  isGeneratingReport.value = true;
  
  try {
    const response = await requestAuth(API_URLS.AI.REPORT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ context: context.value })
    });

    const data = await response.json();
    const html = data.data?.html || data.html;

    if (!html) {
      throw new Error('No HTML content received');
    }

    // 创建 Blob URL 并在新窗口打开
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');

    // 延迟释放 URL
    setTimeout(() => URL.revokeObjectURL(url), 60000);

    addToast({ message: t('ai.reportGenerated'), type: 'success' });
  } catch (err) {
    console.error('[AI Report] Error:', err);
    addToast({ message: t('ai.reportError'), type: 'error' });
  } finally {
    isGeneratingReport.value = false;
  }
};
</script>

<style>
.markdown-body {
  font-size: 0.875rem;
  line-height: 1.6;
  color: var(--text-main);
  word-break: break-word;
}
.markdown-body > *:first-child {
  margin-top: 0;
}
.markdown-body > *:last-child {
  margin-bottom: 0;
}
.markdown-body h1, .markdown-body h2, .markdown-body h3, .markdown-body h4, .markdown-body h5, .markdown-body h6 {
  color: var(--text-main);
  font-weight: 600;
  margin-top: 1.5em;
  margin-bottom: 0.75em;
  line-height: 1.3;
}
.markdown-body h1 { font-size: 1.25em; }
.markdown-body h2 { font-size: 1.15em; }
.markdown-body h3 { font-size: 1.05em; }
.markdown-body p {
  margin-top: 0;
  margin-bottom: 0.75em;
}
.markdown-body a {
  color: varinfo;
  text-decoration: none;
  border-bottom: 1px solid transparent;
  transition: border-color 0.2s;
}
.markdown-body a:hover {
  border-bottom-color: varinfo;
}
.markdown-body ul, .markdown-body ol {
  padding-left: 1.5em;
  margin-top: 0;
  margin-bottom: 0.75em;
}
.markdown-body ul { list-style-type: disc; }
.markdown-body ol { list-style-type: decimal; }
.markdown-body li { margin-bottom: 0.25em; }
.markdown-body li > p { margin-bottom: 0.25em; }
.markdown-body blockquote {
  margin: 0 0 0.75em 0;
  padding: 0.5em 1em;
  color: var(--text-secondary);
  border-left: 3px solid varprimary;
  background-color: color-mix(in srgb, varprimary 5%, transparent);
  border-radius: 0 var(--radius-sm) var(--radius-sm) 0;
}
.markdown-body blockquote p:last-child { margin-bottom: 0; }
.markdown-body code {
  color: var(--text-main);
  background-color: var(--bg-muted);
  padding: 0.2em 0.4em;
  border-radius: var(--radius-sm);
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
  font-size: 0.85em;
}
.markdown-body pre {
  background-color: var(--bg-muted);
  padding: 1em;
  border-radius: var(--radius-lg);
  overflow-x: auto;
  margin-top: 0;
  margin-bottom: 0.75em;
  border: 1px solid var(--border-color);
  box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.05);
}
.markdown-body pre code {
  color: var(--text-main);
  background-color: transparent;
  padding: 0;
  font-size: 0.85em;
  border-radius: 0;
  white-space: pre;
  word-break: normal;
}
.markdown-body table {
  width: 100%;
  max-width: 100%;
  border-collapse: collapse;
  margin-top: 0;
  margin-bottom: 0.75em;
  display: block;
  overflow-x: auto;
  white-space: nowrap;
}
.markdown-body th, .markdown-body td {
  padding: 0.5em 0.75em;
  border: 1px solid var(--border-color);
  font-size: 0.85em;
}
.markdown-body th {
  font-weight: 600;
  background-color: var(--bg-muted);
  color: var(--text-secondary);
  text-align: left;
}
.markdown-body tr:nth-child(2n) {
  background-color: color-mix(in srgb, var(--bg-muted) 30%, transparent);
}
</style>
