<template>
  <!-- 添加到组件根部的外层包装，不限制拖拽溢出，让窗口可以全屏移动 -->
  <div class="pointer-events-none fixed inset-0 z-9999 overflow-hidden">
    <transition
      enter-active-class="transition duration-300 ease-out-expo"
      enter-from-class="translate-y-4 transform scale-95 opacity-0"
      enter-to-class="translate-y-0 transform scale-100 opacity-100"
      leave-active-class="transition duration-200 ease-out-expo"
      leave-from-class="translate-y-0 transform scale-100 opacity-100"
      leave-to-class="translate-y-4 transform scale-95 opacity-0"
    >
      <div
        v-if="isOpen"
        ref="widgetEl"
        :style="
          isMobile
            ? undefined
            : {
                left: `${x}px`,
                top: `${y}px`,
                width: `${width}px`,
                height: `${height}px`,
              }
        "
        :class="[
          'pointer-events-auto flex flex-col overflow-hidden transition-transform',
          isMobile
            ? 'fixed inset-0 z-10000 rounded-none border-0'
            : 'absolute min-h-[300px] max-w-[calc(100vw-2rem)] min-w-[320px]',
        ]"
      >
        <AppCard
          padding="p-0"
          class="flex h-full flex-col border-(--border-color) shadow-2xl backdrop-blur-xl"
        >
          <!-- Header -->
          <div
            ref="dragHandleEl"
            class="bg-primary flex items-center justify-between p-4 text-(--text-inverse) transition-colors"
            :class="isMobile ? '' : 'cursor-move hover:bg-primary/90'"
          >
            <div class="flex items-center gap-3">
              <div class="flex size-8 items-center justify-center rounded-lg bg-(--bg-card)/20">
                <AppIcon name="bolt" class="size-5" />
              </div>
              <div>
                <h3 class="text-sm font-bold">{{ t('ai.assistant') }}</h3>
                <p class="text-[10px] opacity-70">{{ t('ai.subtitle') }}</p>
              </div>
            </div>
            <ActionBar class="border-none bg-transparent px-0 py-0 shadow-none">
              <AppButton
                v-if="messages.length > 1"
                :title="t('ai.clear')"
                variant="ghost"
                size="sm"
                class="!h-8 !w-8 !px-0 text-(--text-inverse) hover:!bg-(--bg-card)/10 hover:!text-(--text-inverse)"
                @click="clearHistory"
              >
                <template #icon-left>
                  <AppIcon name="trash" class="size-5" />
                </template>
              </AppButton>
              <AppButton
                :title="t('common.close')"
                variant="ghost"
                size="sm"
                class="!h-8 !w-8 !px-0 text-(--text-inverse) hover:!bg-(--bg-card)/10 hover:!text-(--text-inverse)"
                @click="close"
              >
                <template #icon-left>
                  <AppIcon name="x-mark" class="size-5" />
                </template>
              </AppButton>
            </ActionBar>
          </div>

          <!-- Messages Area -->
          <div ref="messageContainer" class="flex-1 space-y-4 overflow-y-auto p-4">
            <ChatMessage
              v-for="(msg, index) in messages"
              :key="index"
              :message="msg"
              :is-thinking="
                msg.role === 'assistant' &&
                index === messages.length - 1 &&
                (isThinking || isAwaitingAssistant)
              "
              :tool-status="
                msg.role === 'assistant' && index === messages.length - 1 ? toolStatus : ''
              "
              :show-report-button="shouldShowReportButtonForMessage(msg, index)"
              :is-generating-report="isGeneratingReport"
              @generate-report="generateReport"
            />
            <AIChatActionPanel
              v-if="actionCard"
              :action="actionCard"
              @select="handleCandidateSelect"
              @confirm="confirmAction"
            />
          </div>
          <!-- Input Area -->
          <div
            class="border-t border-(--border-color) bg-(--bg-card) px-4 pt-1 pb-4 transition-colors duration-200"
            :class="isImageHovering ? 'border-primary/30 bg-primary/5' : ''"
            @dragover.prevent="isImageHovering = true"
            @dragleave.prevent="isImageHovering = false"
            @drop.prevent="onDrop"
          >
            <AISuggestions class="mb-2" :suggestions="suggestions" @select="handleSuggestion" />

            <!-- Image Attachment Preview -->
            <div v-if="attachedImage" class="relative mb-3 inline-block">
              <div
                class="flex size-16 items-center justify-center overflow-hidden rounded-xl border border-(--border-color) bg-(--bg-muted) shadow-sm"
              >
                <img
                  :src="attachedImage"
                  alt="Attached"
                  class="max-h-full max-w-full object-cover"
                />
              </div>
              <AppButton
                type="button"
                variant="danger"
                size="sm"
                class="absolute -top-2 -right-2 !h-5 !w-5 !rounded-full !px-0"
                @click="attachedImage = null"
              >
                <template #icon-left>
                  <AppIcon name="x-mark" class="size-3" />
                </template>
              </AppButton>
            </div>

            <form class="relative flex items-end gap-2" @submit.prevent="sendMessage">
              <input
                ref="fileInput"
                type="file"
                class="hidden"
                accept="image/*"
                @change="onFileSelect"
              />
              <AppButton
                :disabled="isStreamingLoading"
                type="button"
                :title="t('ai.uploadImage', '上传图片')"
                variant="ghost"
                size="md"
                class="mb-0.5 shrink-0 !rounded-xl"
                @click="triggerFileInput"
              >
                <template #icon-left>
                  <AppIcon name="photo" class="size-5" />
                </template>
              </AppButton>
              <div class="relative flex-1">
                <AppInput
                  v-model="userInput"
                  :disabled="isStreamingLoading"
                  :placeholder="t('ai.placeholder')"
                  class="[&_input]:rounded-xl [&_input]:border-none [&_input]:bg-(--bg-muted) [&_input]:py-3 [&_input]:pr-12"
                  @paste="onPaste"
                />
                <AppButton
                  :disabled="(!userInput.trim() && !attachedImage) || isStreamingLoading"
                  type="submit"
                  variant="ghost"
                  size="sm"
                  class="absolute top-1.5 right-2 !h-8 !w-8 !px-0 text-primary hover:!bg-primary/10 hover:!text-primary"
                >
                  <template #icon-left>
                    <AppIcon name="paper-airplane" class="size-5" />
                  </template>
                </AppButton>
              </div>
            </form>
          </div>

          <!-- Resize Handle (Desktop Only) -->
          <AppButton
            v-if="!isMobile"
            variant="ghost"
            size="sm"
            class="absolute right-0 bottom-0 z-10 !h-6 !w-6 cursor-se-resize items-end justify-end !px-0 text-(--text-secondary) opacity-50 transition-opacity hover:opacity-100"
            @mousedown.prevent="startResize"
          >
            <template #icon-left>
              <AppIcon name="bars-3" class="size-3" />
            </template>
          </AppButton>
        </AppCard>
      </div>
    </transition>
  </div>
</template>

<script setup>
import { ref, nextTick, watch, computed, onUnmounted } from 'vue';
import { useRoute } from 'vue-router';
import { useDraggable, useStorage, useWindowSize } from '@vueuse/core';
import { API as API_URLS } from '@/utils/constants';
import ChatMessage from '@/components/common/ai/ChatMessage.vue';
import AISuggestions from '@/components/common/ai/AISuggestions.vue';
import AppButton from '@/components/ui/AppButton.vue';
import AppCard from '@/components/ui/AppCard.vue';
import AppIcon from '@/components/ui/AppIcon.vue';
import AppInput from '@/components/ui/AppInput.vue';
import ActionBar from '@/design-system/composed/ActionBar.vue';
import { useI18n } from '@/composables/useI18n';
import { useAI } from '@/composables/useAI';
import { useAIChatSession } from '@/composables/useAIChatSession';
import { useAIStream } from '@/composables/useAIStream';
import { useImageCompression } from '@/composables/useImageCompression';
import { useToast } from '@/composables/useToast';
import { useRequestAdapters } from '@/composables/useRequestAdapters';
import { inferCurrentView, inferAIEntityContext } from '@/components/common/ai/context-inference';
import AIChatActionPanel from '@/components/common/ai/AIChatActionPanel.vue';

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
watch(
  [windowWidth, windowHeight, isOpen],
  ([vw, vh, open]) => {
    if (open) {
      if (x.value + width.value > vw) x.value = Math.max(0, vw - width.value - 24);
      if (y.value + height.value > vh) y.value = Math.max(0, vh - height.value - 24);
    }
  },
  { immediate: true }
);

// 从路由计算当前视图和标题
const currentView = computed(() => inferCurrentView(route.path));
const viewTitle = computed(() => route.meta?.title || document.title);
const currentEntityContext = computed(() =>
  inferAIEntityContext({
    view: currentView.value,
    params: route.params,
    query: route.query,
  })
);

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

const handleFile = async (file) => {
  if (
    !file ||
    (!file.type.startsWith('image/') && !file.name?.match(/\.(jpg|jpeg|png|webp|gif)$/i))
  ) {
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
  messages,
  appendUserMessage,
  beginAssistantDraft,
  applyStreamState,
  finalizeAssistantDraft,
  discardEmptyAssistantDraft,
  resetMessages,
  removeImagesFromLatestUserMessage,
} = useAIChatSession({
  welcomeContent: t('ai.welcome'),
});

const {
  stream: startAIStream,
  fullContent,
  displayedContent: streamContent,
  isThinking,
  isLoading: isStreamingLoading,
  isStreaming: isAIStreaming,
  toolStatus,
  actionCard,
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
  const lastAssistantIndex = messages.value
    .map((m, i) => (m.role === 'assistant' ? i : -1))
    .filter((i) => i >= 0)
    .pop();
  if (index !== lastAssistantIndex) return false;
  // 必须包含报告标记
  return msg.content?.includes('[REPORT_AVAILABLE]');
};

// Listen for streaming content updates
// Use fullContent for markdown rendering (complete text), streamContent for display
watch([fullContent, streamContent], ([full, displayed]) => {
  applyStreamState({ fullContent: full, displayedContent: displayed });
  scrollToBottom();
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
    resetMessages();
  }
};

const confirmAction = async () => {
  if (isStreamingLoading.value || isAIStreaming.value) return;
  userInput.value = t('common.confirm');
  await sendMessage();
};

const handleCandidateSelect = async ({ candidate } = {}) => {
  const value = String(candidate?.value || '').trim();
  if (!value || isStreamingLoading.value || isAIStreaming.value) return;
  userInput.value = value;
  await sendMessage();
};

const sendMessage = async () => {
  if (
    (!userInput.value.trim() && !attachedImage.value) ||
    isStreamingLoading.value ||
    isAIStreaming.value
  )
    return;

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

  appendUserMessage(userParts);
  userInput.value = '';
  attachedImage.value = null;
  // loading state managed by useAIStream
  toolStatus.value = '';
  isAwaitingAssistant.value = true;
  awaitingSince.value = Date.now();
  shouldAutoFollow.value = true;
  await scrollToBottom();

  // Add placeholder for assistant response
  beginAssistantDraft();

  const historyToSend = messages.value
    .slice(-8, -1)
    .map(({ role, content }) => ({ role, content }));

  try {
    await startAIStream({
      messages: historyToSend,
      context: context.value,
    });

    const lastMsg = messages.value[messages.value.length - 1];
    if (lastMsg && lastMsg.role === 'assistant') {
      // Final render with complete fullContent for proper markdown parsing
      let finalAssistantContent = fullContent.value;
      if (
        typeof finalAssistantContent === 'string' &&
        finalAssistantContent.includes('[IMAGE_UNSUPPORTED]')
      ) {
        addToast({
          message: t('ai.modelImageNotSupported', '当前模型不支持识别图片，请移除图片或切换模型。'),
          type: 'error',
        });
        finalAssistantContent = finalAssistantContent.replace('[IMAGE_UNSUPPORTED]', '').trim();
      }
      finalizeAssistantDraft(finalAssistantContent);
    }
  } catch (_err) {
    // Error is handled in useAIStream (toast)
    discardEmptyAssistantDraft();
    if (_err?.isImageError) {
      removeImagesFromLatestUserMessage();
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
      body: JSON.stringify({ context: context.value }),
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
.markdown-body h1,
.markdown-body h2,
.markdown-body h3,
.markdown-body h4,
.markdown-body h5,
.markdown-body h6 {
  color: var(--text-main);
  font-weight: 600;
  margin-top: 1.5em;
  margin-bottom: 0.75em;
  line-height: 1.3;
}
.markdown-body h1 {
  font-size: 1.25em;
}
.markdown-body h2 {
  font-size: 1.15em;
}
.markdown-body h3 {
  font-size: 1.05em;
}
.markdown-body p {
  margin-top: 0;
  margin-bottom: 0.75em;
}
.markdown-body a {
  color: var(--color-info);
  text-decoration: none;
  border-bottom: 1px solid transparent;
  transition: border-color 0.2s;
}
.markdown-body a:hover {
  border-bottom-color: var(--color-info);
}
.markdown-body ul,
.markdown-body ol {
  padding-left: 1.5em;
  margin-top: 0;
  margin-bottom: 0.75em;
}
.markdown-body ul {
  list-style-type: disc;
}
.markdown-body ol {
  list-style-type: decimal;
}
.markdown-body li {
  margin-bottom: 0.25em;
}
.markdown-body li > p {
  margin-bottom: 0.25em;
}
.markdown-body blockquote {
  margin: 0 0 0.75em 0;
  padding: 0.5em 1em;
  color: var(--text-secondary);
  border-left: 3px solid varprimary;
  background-color: color-mix(in srgb, varprimary 5%, transparent);
  border-radius: 0 var(--radius-sm) var(--radius-sm) 0;
}
.markdown-body blockquote p:last-child {
  margin-bottom: 0;
}
.markdown-body code {
  color: var(--text-main);
  background-color: var(--bg-muted);
  padding: 0.2em 0.4em;
  border-radius: var(--radius-sm);
  font-family:
    ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New',
    monospace;
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
  box-shadow: inset 0 1px 2px var(--shadow-sm);
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
.markdown-body th,
.markdown-body td {
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
