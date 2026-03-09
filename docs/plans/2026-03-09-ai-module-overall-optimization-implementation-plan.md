# AI 模块整体优化 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 在不改变现有 `/api/manage/ai/chat`、`/api/manage/ai/stream`、`/api/manage/ai/report` 对外协议的前提下，完成 AI 模块前后端分层收敛、状态统一、交互恢复与关键测试补强。

**Architecture:** 这次实现分成两条主线。前端主线把 `src/components/common/AIChatWidget.vue` 从“巨型全功能组件”拆成壳层、会话层、动作层，并把消息生命周期与 SSE 动作状态收口到 composable。后端主线把 `functions/lib/hono/routes/manage/ai.js` 中的运行时配置、动作上下文、流式引擎、会话准备与遥测逻辑抽出成独立模块，让路由回归薄入口，同时补齐可恢复错误反馈与关键行为测试。

**Tech Stack:** Vue 3、Vue Test Utils、Vitest、Hono、Cloudflare Workers、D1、现有 AI stream/tool/action 基础设施

---

### Task 1: 收口前端消息生命周期到 `useAIConversation`

**Files:**
- Create: `src/composables/useAIConversation.js`
- Create: `src/composables/__tests__/useAIConversation.test.js`
- Modify: `src/components/common/AIChatWidget.vue`

**Step 1: Write the failing test**

在 `src/composables/__tests__/useAIConversation.test.js` 里先锁定三个行为：

```js
import { describe, expect, it } from 'vitest';
import { useAIConversation } from '../useAIConversation.js';

function createTextPart(text) {
  return { type: 'text', text };
}

describe('useAIConversation', () => {
  it('adds user message and assistant placeholder before streaming starts', () => {
    const conversation = useAIConversation();

    conversation.beginTurn({
      userParts: [createTextPart('帮我创建客户 Alice')],
    });

    expect(conversation.messages.value.at(-2)).toEqual(
      expect.objectContaining({ role: 'user' })
    );
    expect(conversation.messages.value.at(-1)).toEqual(
      expect.objectContaining({ role: 'assistant', content: '', html: '' })
    );
  });

  it('finalizes the last assistant message with fixed markdown content', () => {
    const conversation = useAIConversation();
    conversation.beginTurn({ userParts: [createTextPart('给我日报')] });

    conversation.finalizeAssistantMessage({
      fullContent: '## 标题',
      displayedContent: '## 标',
      fixedContent: '## 标题',
      renderHtml: (value) => `<p>${value}</p>`,
    });

    expect(conversation.messages.value.at(-1)).toEqual(
      expect.objectContaining({ role: 'assistant', content: '## 标题', html: '<p>## 标题</p>' })
    );
  });

  it('removes the empty assistant placeholder when streaming fails before any text arrives', () => {
    const conversation = useAIConversation();
    conversation.beginTurn({ userParts: [createTextPart('分析失败场景')] });

    conversation.discardEmptyAssistantMessage();

    expect(conversation.messages.value.at(-1)).toEqual(
      expect.objectContaining({ role: 'user' })
    );
  });
});
```

**Step 2: Run test to verify it fails**

Run: `node node_modules/vitest/vitest.mjs run src/composables/__tests__/useAIConversation.test.js`

Expected: FAIL，提示缺少 `useAIConversation` 导出或行为不匹配。

**Step 3: Write minimal implementation**

在 `src/composables/useAIConversation.js` 中实现最小可用版本，先把现在 `AIChatWidget.vue` 内的消息生命周期提出来：

```js
import { ref } from 'vue';

export function useAIConversation() {
  const messages = ref([]);

  const beginTurn = ({ userParts }) => {
    messages.value.push({ role: 'user', content: userParts, html: '' });
    messages.value.push({ role: 'assistant', content: '', html: '' });
  };

  const finalizeAssistantMessage = ({ fixedContent, renderHtml }) => {
    const last = messages.value.at(-1);
    if (!last || last.role !== 'assistant') return;
    last.content = fixedContent;
    last.html = renderHtml(fixedContent);
  };

  const discardEmptyAssistantMessage = () => {
    const last = messages.value.at(-1);
    if (last?.role === 'assistant' && !last.content && !last.html) {
      messages.value.pop();
    }
  };

  return {
    messages,
    beginTurn,
    finalizeAssistantMessage,
    discardEmptyAssistantMessage,
  };
}
```

然后把 `src/components/common/AIChatWidget.vue` 中以下逻辑先改为调用新 composable：

1. 用户消息 push
2. assistant placeholder push
3. 流结束后的最终落盘
4. 出错时清理空 assistant 消息

**Step 4: Run test to verify it passes**

Run: `node node_modules/vitest/vitest.mjs run src/composables/__tests__/useAIConversation.test.js`

Expected: PASS。

**Step 5: Commit**

```bash
git add src/composables/useAIConversation.js src/composables/__tests__/useAIConversation.test.js src/components/common/AIChatWidget.vue
git commit -m "refactor(ai): extract conversation message lifecycle"
```

---

### Task 2: 把 `AIChatWidget` 拆成壳层、会话层、动作层

**Files:**
- Create: `src/components/common/ai/AIConversationPanel.vue`
- Create: `src/components/common/ai/AIActionPanel.vue`
- Create: `src/components/common/ai/__tests__/AIActionPanel.test.js`
- Modify: `src/components/common/AIChatWidget.vue`
- Modify: `src/App.vue`

**Step 1: Write the failing test**

在 `src/components/common/ai/__tests__/AIActionPanel.test.js` 中先锁定动作层行为，不再让 `AIChatWidget.vue` 直接内嵌三种卡片分支：

```js
import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import AIActionPanel from '../AIActionPanel.vue';

const slotAction = { type: 'slot_request', missingSlots: ['salespersonId'], fields: [] };
const previewAction = { type: 'action_preview', title: '订单创建预览', summary: { productName: '跑鞋' } };
const resultAction = { type: 'action_result', successMessage: '订单已创建' };

describe('AIActionPanel', () => {
  it('renders SlotQuestionCard for slot_request', () => {
    const wrapper = mount(AIActionPanel, { props: { actionCard: slotAction } });
    expect(wrapper.findComponent({ name: 'SlotQuestionCard' }).exists()).toBe(true);
  });

  it('renders ActionPreviewCard for action_preview', () => {
    const wrapper = mount(AIActionPanel, { props: { actionCard: previewAction } });
    expect(wrapper.findComponent({ name: 'ActionPreviewCard' }).exists()).toBe(true);
  });

  it('renders ActionResultCard for action_result', () => {
    const wrapper = mount(AIActionPanel, { props: { actionCard: resultAction } });
    expect(wrapper.findComponent({ name: 'ActionResultCard' }).exists()).toBe(true);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `node node_modules/vitest/vitest.mjs run src/components/common/ai/__tests__/AIActionPanel.test.js`

Expected: FAIL，提示缺少 `AIActionPanel.vue`。

**Step 3: Write minimal implementation**

新增 `src/components/common/ai/AIActionPanel.vue`，只承接动作卡片渲染和事件转发：

```vue
<template>
  <SlotQuestionCard
    v-if="actionCard?.type === 'slot_request'"
    :action="actionCard"
    @select="$emit('select', $event)"
  />
  <ActionPreviewCard
    v-else-if="actionCard?.type === 'action_preview'"
    :action="actionCard"
    @confirm="$emit('confirm')"
  />
  <ActionResultCard
    v-else-if="actionCard?.type === 'action_result'"
    :action="actionCard"
  />
</template>
```

新增 `src/components/common/ai/AIConversationPanel.vue`，只承接：

1. `messages` 列表
2. thinking/toolStatus 展示
3. action panel 挂载点
4. 输入区插槽或受控 props

然后把 `src/components/common/AIChatWidget.vue` 收缩成：

1. 弹窗壳子
2. 拖拽与缩放
3. 组合 `useAIConversation`、`useAIStream`
4. 把消息与动作 props 传给 `AIConversationPanel`

`src/App.vue` 只保留原始 `<AIChatWidget />` 用法，不改挂载位置。

**Step 4: Run test to verify it passes**

Run: `node node_modules/vitest/vitest.mjs run src/components/common/ai/__tests__/AIActionPanel.test.js`

Expected: PASS。

**Step 5: Commit**

```bash
git add src/components/common/ai/AIConversationPanel.vue src/components/common/ai/AIActionPanel.vue src/components/common/ai/__tests__/AIActionPanel.test.js src/components/common/AIChatWidget.vue src/App.vue
git commit -m "refactor(ai): split chat widget into shell conversation and action panels"
```

---

### Task 3: 优化 `SlotQuestionCard` 的重选与恢复体验

**Files:**
- Modify: `src/components/common/ai/SlotQuestionCard.vue`
- Modify: `src/components/common/ai/__tests__/SlotQuestionCard.test.js`

**Step 1: Write the failing test**

在现有 `src/components/common/ai/__tests__/SlotQuestionCard.test.js` 上追加两个失败用例：

```js
it('allows clearing a locally selected candidate before the next server round', async () => {
  const wrapper = mount(SlotQuestionCard, {
    props: {
      action: {
        missingSlots: ['salespersonId'],
        fields: [{
          key: 'salespersonId',
          label: '销售员',
          candidates: [
            { value: 'sp-1', label: '张三' },
            { value: 'sp-2', label: '李四' },
          ],
        }],
      },
    },
  });

  await wrapper.find('[data-testid="candidate-option-0"]').trigger('click');
  await wrapper.find('[data-testid="clear-selection-salespersonId"]').trigger('click');

  expect(wrapper.text()).not.toContain('已选择');
  expect(wrapper.find('[data-testid="candidate-option-1"]').attributes('disabled')).toBeUndefined();
});

it('shows a current-target hint when multiple missing slots remain', () => {
  const wrapper = mount(SlotQuestionCard, {
    props: {
      action: {
        prompt: '还需要补充：商品、销售员',
        missingSlots: ['productId', 'salespersonId'],
        fields: [],
        currentFieldLabel: '商品',
      },
    },
  });

  expect(wrapper.text()).toContain('当前优先补充：商品');
});
```

**Step 2: Run test to verify it fails**

Run: `node node_modules/vitest/vitest.mjs run src/components/common/ai/__tests__/SlotQuestionCard.test.js`

Expected: FAIL，因为当前组件选中后会锁死，且没有“当前优先补充”提示。

**Step 3: Write minimal implementation**

在 `src/components/common/ai/SlotQuestionCard.vue` 中做最小收口：

```vue
<button
  v-if="selectedCandidates[field.key]"
  :data-testid="`clear-selection-${field.key}`"
  type="button"
  class="text-xs text-(--text-secondary) underline"
  @click="clearSelection(field.key)"
>
  重新选择
</button>

<p v-if="currentFieldLabel" class="mt-2 text-xs text-(--text-secondary)">
  当前优先补充：{{ currentFieldLabel }}
</p>
```

```js
const currentFieldLabel = computed(() => String(props.action?.currentFieldLabel || '').trim());

const clearSelection = (fieldKey) => {
  const next = { ...selectedCandidates.value };
  delete next[fieldKey];
  selectedCandidates.value = next;
};
```

注意：

1. 只放开本地重选，不引入新的后端协议。
2. 仍保持点击候选会 emit `select`。
3. 只让本地 UI 允许重选，避免继续增加状态复杂度。

**Step 4: Run test to verify it passes**

Run: `node node_modules/vitest/vitest.mjs run src/components/common/ai/__tests__/SlotQuestionCard.test.js`

Expected: PASS。

**Step 5: Commit**

```bash
git add src/components/common/ai/SlotQuestionCard.vue src/components/common/ai/__tests__/SlotQuestionCard.test.js
git commit -m "feat(ai): allow slot candidate reselection and target hints"
```

---

### Task 4: 为 `useAIStream` 增加显式流阶段与统一错误状态

**Files:**
- Modify: `src/composables/useAIStream.js`
- Modify: `src/composables/__tests__/useAIStream.test.js`

**Step 1: Write the failing test**

在 `src/composables/__tests__/useAIStream.test.js` 里新增状态归约测试：

```js
it('tracks stream phases for text tool and action events', () => {
  const state = {
    actionCard: null,
    streamPhase: 'idle',
    lastError: null,
  };

  reduceAIStreamEvent({ type: 'slot_request', data: { sessionId: 'act-1' } }, state, {});
  expect(state.actionCard).toEqual(expect.objectContaining({ type: 'slot_request' }));

  state.streamPhase = 'streaming';
  reduceAIStreamEvent({ type: 'action_submitted', data: { sessionId: 'act-1' } }, state, {});
  expect(state.actionCard).toEqual(expect.objectContaining({ type: 'action_result' }));
});

it('classifies tool round exhaustion as a handled tool error', () => {
  const result = classifyAIStreamError('AI tool round limit reached');
  expect(result.isHandled).toBe(true);
  expect(result.kind).toBe('tool_round_limit');
});
```

**Step 2: Run test to verify it fails**

Run: `node node_modules/vitest/vitest.mjs run src/composables/__tests__/useAIStream.test.js`

Expected: FAIL，因为当前没有 `streamPhase`、`tool_round_limit` 分类或统一错误状态。

**Step 3: Write minimal implementation**

在 `src/composables/useAIStream.js` 中补最小状态：

```js
const streamPhase = ref('idle');
const lastError = ref(null);
```

扩展错误分类：

```js
if (lower.includes('tool round limit')) {
  kind = 'tool_round_limit';
  return {
    message,
    isHandled: true,
    isImageError: false,
    kind,
  };
}
```

在 `stream()` 内用显式阶段替代“隐式猜测”：

1. 发请求前：`requesting`
2. 收到 body 后：`streaming`
3. 收到 `tool_call`：`tool_running`
4. 正常结束：`completed`
5. 出错：`failed`

并把 `lastError.value` 作为 composable 输出，供上层控制 toast 与恢复动作。

**Step 4: Run test to verify it passes**

Run: `node node_modules/vitest/vitest.mjs run src/composables/__tests__/useAIStream.test.js`

Expected: PASS。

**Step 5: Commit**

```bash
git add src/composables/useAIStream.js src/composables/__tests__/useAIStream.test.js
git commit -m "refactor(ai): add explicit stream phases and unified stream errors"
```

---

### Task 5: 抽离后端动作上下文与运行时配置辅助模块

**Files:**
- Create: `functions/ai/action-context.js`
- Create: `functions/ai/runtime-env.js`
- Create: `functions/ai/__tests__/action-context.test.js`
- Create: `functions/ai/__tests__/runtime-env.test.js`
- Modify: `functions/lib/hono/routes/manage/ai.js`

**Step 1: Write the failing tests**

在两个新测试文件里先锁定从大路由中要抽出的纯函数行为：

```js
import { describe, expect, it, vi } from 'vitest';
import { detectExplicitConfirmation, deriveContextActionSlots } from '../action-context.js';
import { resolveAIRuntimeEnv } from '../runtime-env.js';

it('detects explicit confirmation only for whitelisted confirmation phrases', () => {
  expect(detectExplicitConfirmation('确认')).toBe(true);
  expect(detectExplicitConfirmation('那你看着办')).toBe(false);
});

it('derives product and variant context slots from selected context', async () => {
  const productRepo = { findById: vi.fn(async () => ({ id: 'prod-1', name: '跑鞋' })) };
  const variantRepo = { findById: vi.fn(async () => ({ id: 'var-1', product_id: 'prod-1' })) };

  const slots = await deriveContextActionSlots(
    { selectedId: 'var-1', selectedType: 'variant' },
    { productRepo, variantRepo }
  );

  expect(slots).toEqual(expect.objectContaining({ productId: 'prod-1', variantId: 'var-1', productName: '跑鞋' }));
});

it('prefers ai settings loaded from SettingsRepository grouped output', async () => {
  const env = { DB: {}, AI_API_URL: 'fallback-url', AI_MODEL: 'fallback-model' };
  const runtimeEnv = await resolveAIRuntimeEnv(env, {
    createSettingsRepository: () => ({
      getAllGrouped: async () => ({ ai: { AI_API_URL: 'db-url', AI_MODEL: 'db-model' } }),
    }),
  });

  expect(runtimeEnv.AI_API_URL).toBe('db-url');
  expect(runtimeEnv.AI_MODEL).toBe('db-model');
});
```

**Step 2: Run test to verify it fails**

Run: `node node_modules/vitest/vitest.mjs run functions/ai/__tests__/action-context.test.js functions/ai/__tests__/runtime-env.test.js`

Expected: FAIL，因为新模块尚不存在。

**Step 3: Write minimal implementation**

把以下函数从 `functions/lib/hono/routes/manage/ai.js` 原样或近原样抽出：

1. `detectExplicitConfirmation`
2. `deriveContextActionSlots`
3. `resolveAIRuntimeEnv`

`functions/ai/action-context.js`：

```js
export function detectExplicitConfirmation(text = '') {
  const normalized = String(text || '').trim();
  return /^(确认|确定|提交|创建吧|就这样|可以创建了)$/.test(normalized);
}

export async function deriveContextActionSlots(context = {}, { productRepo, variantRepo }) {
  // 从当前 ai.js 迁移现有 product / variant context 推导逻辑
}
```

`functions/ai/runtime-env.js`：

```js
import { SettingsRepository } from '../repositories/SettingsRepository.js';

export async function resolveAIRuntimeEnv(env, options = {}) {
  const createSettingsRepository = options.createSettingsRepository
    || ((db) => new SettingsRepository(db));
  // 从当前 ai.js 迁移 grouped settings 合并逻辑
}
```

然后在 `functions/lib/hono/routes/manage/ai.js` 里改为 import 使用。

**Step 4: Run test to verify it passes**

Run: `node node_modules/vitest/vitest.mjs run functions/ai/__tests__/action-context.test.js functions/ai/__tests__/runtime-env.test.js`

Expected: PASS。

**Step 5: Commit**

```bash
git add functions/ai/action-context.js functions/ai/runtime-env.js functions/ai/__tests__/action-context.test.js functions/ai/__tests__/runtime-env.test.js functions/lib/hono/routes/manage/ai.js
git commit -m "refactor(ai): extract action context and runtime env helpers"
```

---

### Task 6: 提取流式引擎 `stream-engine` 并锁定工具轮次边界

**Files:**
- Create: `functions/ai/stream-engine.js`
- Create: `functions/ai/__tests__/stream-engine.test.js`
- Modify: `functions/lib/hono/routes/manage/ai.js`
- Modify: `functions/utils/ai-stream-helpers.js`

**Step 1: Write the failing tests**

在 `functions/ai/__tests__/stream-engine.test.js` 中先锁定从大路由中抽出的两个核心行为：

```js
import { describe, expect, it, vi } from 'vitest';
import { createAIStreamEngine } from '../stream-engine.js';

it('writes text_delta events for safe content and preserves accumulated tool calls', async () => {
  const writeSSE = vi.fn(async () => {});
  const engine = createAIStreamEngine({ writeSSE, parseSSEChunk: (raw) => [JSON.parse(raw)] });

  const result = await engine.processChunks([
    JSON.stringify({ choices: [{ delta: { content: '你好' } }] }),
    JSON.stringify({ choices: [{ delta: { tool_calls: [{ index: 0, id: 'tc-1', function: { name: 'searchProducts', arguments: '{}' } }] } }] }),
  ]);

  expect(writeSSE).toHaveBeenCalledWith(expect.objectContaining({ event: 'text_delta' }));
  expect(result.toolCalls[0]).toEqual(expect.objectContaining({ id: 'tc-1', name: 'searchProducts' }));
});

it('returns a user-visible tool limit error payload when max rounds is exhausted', async () => {
  const engine = createAIStreamEngine({ writeSSE: vi.fn(async () => {}) });
  const result = await engine.exhaustedToolRounds();
  expect(result).toEqual(expect.objectContaining({ code: 'tool_round_limit' }));
});
```

**Step 2: Run test to verify it fails**

Run: `node node_modules/vitest/vitest.mjs run functions/ai/__tests__/stream-engine.test.js`

Expected: FAIL，因为还没有独立的 `stream-engine.js`。

**Step 3: Write minimal implementation**

新增 `functions/ai/stream-engine.js`，把当前 `ai.js` 里的 `processStreamToSSE()` 与 `handleToolCallsToSSE()` 收进工厂：

```js
import { ContentGate, extractToolCallsFromText } from '../utils/ai-stream-helpers.js';

export function createAIStreamEngine(deps = {}) {
  return {
    async processStreamToSSE(aiStream, sseStream, options = {}) {
      // 从 ai.js 迁移现有实现
    },
    async handleToolCallsToSSE(toolCalls, fullContent, messages, executeTool, sseStream, env, options = {}) {
      // 从 ai.js 迁移现有实现
    },
    async exhaustedToolRounds() {
      return {
        code: 'tool_round_limit',
        message: '本轮分析过于复杂，请缩小问题范围或换一种问法。',
      };
    },
  };
}
```

同时改 `functions/lib/hono/routes/manage/ai.js` 为调用新引擎；不要再保留两个超长内部 helper。

**Step 4: Run test to verify it passes**

Run: `node node_modules/vitest/vitest.mjs run functions/ai/__tests__/stream-engine.test.js`

Expected: PASS。

**Step 5: Commit**

```bash
git add functions/ai/stream-engine.js functions/ai/__tests__/stream-engine.test.js functions/lib/hono/routes/manage/ai.js functions/utils/ai-stream-helpers.js
git commit -m "refactor(ai): extract stream engine and tool-round boundaries"
```

---

### Task 7: 提取会话准备层并瘦身 `manage/ai.js`

**Files:**
- Create: `functions/ai/conversation-service.js`
- Create: `functions/ai/report-service.js`
- Create: `functions/ai/__tests__/conversation-service.test.js`
- Modify: `functions/lib/hono/routes/manage/ai.js`
- Modify: `functions/lib/hono/routes/manage/__tests__/ai-routes.test.js`
- Modify: `functions/lib/hono/routes/manage/__tests__/ai-action-routes.test.js`

**Step 1: Write the failing tests**

在 `functions/ai/__tests__/conversation-service.test.js` 中先锁定 chat / stream 共用准备逻辑：

```js
import { describe, expect, it } from 'vitest';
import { buildAIConversationRequest } from '../conversation-service.js';

it('builds system-first messages and disables tools in vision-first mode', () => {
  const result = buildAIConversationRequest({
    history: [{ role: 'user', content: [{ type: 'text', text: '这是什么商品' }, { type: 'image_url', image_url: { url: 'data:image/png;base64,abc' } }] }],
    clientContext: { path: '/products' },
    todayDate: '2026/03/09',
    tools: [{ name: 'searchProducts' }],
    systemPrompt: 'base-prompt',
  });

  expect(result.messages[0]).toEqual(expect.objectContaining({ role: 'system' }));
  expect(String(result.messages[0].content)).toContain('图像优先');
  expect(result.tools).toEqual([]);
});

it('keeps tools enabled when latest user turn has no image', () => {
  const result = buildAIConversationRequest({
    history: [{ role: 'user', content: '查库存不足商品' }],
    clientContext: {},
    todayDate: '2026/03/09',
    tools: [{ name: 'searchProducts' }],
    systemPrompt: 'base-prompt',
  });

  expect(result.tools).toHaveLength(1);
});
```

**Step 2: Run test to verify it fails**

Run: `node node_modules/vitest/vitest.mjs run functions/ai/__tests__/conversation-service.test.js functions/lib/hono/routes/manage/__tests__/ai-routes.test.js functions/lib/hono/routes/manage/__tests__/ai-action-routes.test.js`

Expected: FAIL，因为现在 chat / stream 准备逻辑还耦合在 `ai.js` 中。

**Step 3: Write minimal implementation**

新增 `functions/ai/conversation-service.js`：

```js
export function buildAIConversationRequest({ history, clientContext, todayDate, tools, systemPrompt }) {
  const visionFirst = hasImageInLatestUserTurn(history);
  const systemContent = buildSystemContent(systemPrompt, { visionFirst });
  return {
    visionFirst,
    messages: [{ role: 'system', content: systemContent }, ...history],
    tools: visionFirst ? [] : tools,
  };
}
```

新增 `functions/ai/report-service.js`，把 `REPORT_SYSTEM_PROMPT` 与 html 清理逻辑收进去：

```js
export function buildAIReportPrompt(date, toolResults) {
  return `...`;
}

export function normalizeReportHtml(content = '') {
  return String(content || '').replace(/^```html\n?|```$/g, '').trim();
}
```

然后把 `functions/lib/hono/routes/manage/ai.js` 改为：

1. 路由层只读参数和依赖
2. 调 `buildAIConversationRequest()`
3. 调 `resolveAIRuntimeEnv()`、`detectExplicitConfirmation()`、`deriveContextActionSlots()`、`createAIStreamEngine()`
4. report 路由改走 `report-service`

**Step 4: Run test to verify it passes**

Run: `node node_modules/vitest/vitest.mjs run functions/ai/__tests__/conversation-service.test.js functions/lib/hono/routes/manage/__tests__/ai-routes.test.js functions/lib/hono/routes/manage/__tests__/ai-action-routes.test.js`

Expected: PASS。

**Step 5: Commit**

```bash
git add functions/ai/conversation-service.js functions/ai/report-service.js functions/ai/__tests__/conversation-service.test.js functions/lib/hono/routes/manage/ai.js functions/lib/hono/routes/manage/__tests__/ai-routes.test.js functions/lib/hono/routes/manage/__tests__/ai-action-routes.test.js
git commit -m "refactor(ai): move conversation and report prep out of manage ai route"
```

---

### Task 8: 把工具上限、Action 失败与刷新结果做成可恢复用户反馈

**Files:**
- Modify: `functions/lib/hono/routes/manage/ai.js`
- Modify: `functions/ai/stream-engine.js`
- Modify: `src/composables/useAIStream.js`
- Modify: `src/components/common/ai/ActionPreviewCard.vue`
- Modify: `src/components/common/ai/ActionResultCard.vue`
- Modify: `src/composables/__tests__/useAIStream.test.js`
- Modify: `functions/lib/hono/routes/manage/__tests__/ai-routes.test.js`

**Step 1: Write the failing tests**

先锁定两类“用户可感知”的恢复反馈：

```js
it('shows a handled toast/error state for tool round limit events', () => {
  const result = classifyAIStreamError('AI tool round limit reached');
  expect(result.kind).toBe('tool_round_limit');
  expect(result.isHandled).toBe(true);
});

it('keeps preview card visible when action submit fails with retryable error', async () => {
  // mount ActionPreviewCard with retryable action error meta
  // expect retry guidance text to render while keeping confirm button region visible
});
```

**Step 2: Run test to verify it fails**

Run: `node node_modules/vitest/vitest.mjs run src/composables/__tests__/useAIStream.test.js functions/lib/hono/routes/manage/__tests__/ai-routes.test.js`

Expected: FAIL，因为当前只做 toast 或服务端 warn，没有稳定的恢复语义。

**Step 3: Write minimal implementation**

后端：

1. 在 `stream-engine.js` 达到 tool 上限时向 SSE 输出统一 error payload：

```js
await sseStream.writeSSE({
  event: 'error',
  data: JSON.stringify({
    message: 'AI tool round limit reached',
    code: 'tool_round_limit',
    retryable: true,
  }),
});
```

2. Action submit 失败时保留现有 preview payload，并补充：

```js
{
  event: 'action_preview',
  data: {
    ...preview,
    error: {
      code: 'submit_failed',
      retryable: true,
      userMessage: '提交失败，请修正信息后重试。',
    },
  },
}
```

前端：

1. `useAIStream.js` 识别 `code` 与 `retryable`
2. `ActionPreviewCard.vue` 在 `action.error?.userMessage` 存在时渲染恢复提示
3. `ActionResultCard.vue` 对“已创建但刷新失败”展示次级说明文本

**Step 4: Run test to verify it passes**

Run: `node node_modules/vitest/vitest.mjs run src/composables/__tests__/useAIStream.test.js functions/lib/hono/routes/manage/__tests__/ai-routes.test.js`

Expected: PASS。

**Step 5: Commit**

```bash
git add functions/lib/hono/routes/manage/ai.js functions/ai/stream-engine.js src/composables/useAIStream.js src/components/common/ai/ActionPreviewCard.vue src/components/common/ai/ActionResultCard.vue src/composables/__tests__/useAIStream.test.js functions/lib/hono/routes/manage/__tests__/ai-routes.test.js
git commit -m "feat(ai): add retryable feedback for tool and action failures"
```

---

### Task 9: 统一 AI 请求遥测字段并补回归测试

**Files:**
- Create: `functions/ai/telemetry.js`
- Create: `functions/ai/__tests__/telemetry.test.js`
- Modify: `functions/lib/hono/routes/manage/ai.js`

**Step 1: Write the failing test**

在 `functions/ai/__tests__/telemetry.test.js` 中锁定统一日志 payload：

```js
import { describe, expect, it } from 'vitest';
import { buildAITelemetryPayload } from '../telemetry.js';

it('builds a consistent telemetry payload for stream requests', () => {
  const payload = buildAITelemetryPayload({
    requestId: 'req-1',
    userId: 'u-1',
    sessionId: 'act-1',
    routeType: 'stream',
    selectedModel: 'model-a',
    modelSwitched: false,
    toolRounds: 2,
    executedTools: 3,
    entityType: 'order',
    finalStatus: 'completed',
  });

  expect(payload).toEqual(expect.objectContaining({
    requestId: 'req-1',
    routeType: 'stream',
    entityType: 'order',
    finalStatus: 'completed',
  }));
});
```

**Step 2: Run test to verify it fails**

Run: `node node_modules/vitest/vitest.mjs run functions/ai/__tests__/telemetry.test.js`

Expected: FAIL，因为当前没有统一 telemetry builder。

**Step 3: Write minimal implementation**

新增 `functions/ai/telemetry.js`：

```js
export function buildAITelemetryPayload(input = {}) {
  return {
    requestId: input.requestId || null,
    userId: input.userId || null,
    sessionId: input.sessionId || null,
    routeType: input.routeType || null,
    visionFirst: Boolean(input.visionFirst),
    selectedModel: input.selectedModel || null,
    modelSwitched: Boolean(input.modelSwitched),
    toolRounds: Number(input.toolRounds || 0),
    executedTools: Number(input.executedTools || 0),
    actionKind: input.actionKind || null,
    entityType: input.entityType || null,
    finalStatus: input.finalStatus || null,
  };
}
```

然后在 `functions/lib/hono/routes/manage/ai.js` 把现有散落的 `console.info / console.warn` payload 尽量统一字段后再输出。

**Step 4: Run test to verify it passes**

Run: `node node_modules/vitest/vitest.mjs run functions/ai/__tests__/telemetry.test.js`

Expected: PASS。

**Step 5: Commit**

```bash
git add functions/ai/telemetry.js functions/ai/__tests__/telemetry.test.js functions/lib/hono/routes/manage/ai.js
git commit -m "refactor(ai): normalize telemetry payload fields"
```

---

### Task 10: 运行验证并记录验收结果

**Files:**
- Modify: `docs/plans/2026-03-09-ai-module-overall-optimization-implementation-plan.md`

**Step 1: Run targeted frontend tests**

Run:

```bash
node node_modules/vitest/vitest.mjs run \
  src/composables/__tests__/useAIConversation.test.js \
  src/components/common/ai/__tests__/AIActionPanel.test.js \
  src/components/common/ai/__tests__/SlotQuestionCard.test.js \
  src/composables/__tests__/useAIStream.test.js
```

Expected: all PASS。

**Step 2: Run targeted backend tests**

Run:

```bash
node node_modules/vitest/vitest.mjs run \
  functions/ai/__tests__/action-context.test.js \
  functions/ai/__tests__/runtime-env.test.js \
  functions/ai/__tests__/stream-engine.test.js \
  functions/ai/__tests__/conversation-service.test.js \
  functions/ai/__tests__/telemetry.test.js \
  functions/lib/hono/routes/manage/__tests__/ai-routes.test.js \
  functions/lib/hono/routes/manage/__tests__/ai-action-routes.test.js
```

Expected: all PASS。

**Step 3: Run lint on the touched code**

Run: `pnpm lint`

Expected: PASS，或只剩与本次修改无关的既有问题。

**Step 4: Manual smoke checklist**

1. 打开任意后台页面，确认 `App.vue` 仍正常挂载 AI 聊天窗口。
2. 发送普通查询，确认文本消息正常流式输出，结束后最终 markdown 正常落盘。
3. 发送创建类请求，确认出现 `slot_request` 卡片而不是纯文本提示。
4. 选择候选项后点击“重新选择”，确认本地 UI 可恢复。
5. 完成预览后点击确认，确认成功卡片出现且对应模块静默刷新。
6. 人为制造工具超轮次或提交失败，确认用户能看到明确、可恢复的提示。

**Step 5: Commit**

```bash
git add docs/plans/2026-03-09-ai-module-overall-optimization-implementation-plan.md
git commit -m "docs: record ai module optimization verification results"
```
