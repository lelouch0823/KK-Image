# Common UI Components Extraction Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Extract and standardize reusable UI components to reduce code duplication, improve maintainability, and ensure a consistent premium experience across the application.

**Architecture:** We will create new components in `src/components/ui/` and gradually migrate existing usages. Each component will follow existing design system conventions (CSS variables). We prioritize high-impact, low-risk extractions first.

**Tech Stack:** Vue 3 `<script setup>`, Tailwind CSS v4, CSS variables for theming.

---

## UI/UX Design Principles

> [!IMPORTANT]
> **All components MUST follow these UI/UX best practices:**

### Interaction Guidelines
| Rule | Implementation |
|------|----------------|
| **Cursor pointer** | Add `cursor-pointer` to all clickable/hoverable elements |
| **Smooth transitions** | Use `transition-all duration-200` (150-300ms range) |
| **Hover feedback** | Provide visual feedback via color, shadow, or opacity change |
| **No layout shift** | Avoid `scale` transforms on hover; use `shadow`, `opacity`, or `-translate-y-1` |
| **Focus states** | Add `focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]` for keyboard a11y |

### Visual Quality
| Rule | Implementation |
|------|----------------|
| **No emoji icons** | Use SVG icons (Heroicons style) everywhere |
| **Consistent icon sizing** | Use fixed `size-5` or `size-6` with `viewBox="0 0 24 24"` |
| **Light/dark mode contrast** | Test all components in both modes; ensure 4.5:1 contrast ratio |
| **Glass elements in light mode** | Use `bg-white/80` minimum opacity for visibility |

### Accessibility
| Rule | Implementation |
|------|----------------|
| **Keyboard navigation** | Support `Escape`, `ArrowLeft`, `ArrowRight` in Lightbox |
| **ARIA labels** | Add `aria-label` to icon-only buttons |
| **Reduced motion** | Respect `prefers-reduced-motion` for animations |

---

## User Review Required

> [!IMPORTANT]
> **Lightbox Consolidation Strategy:** There are two Lightbox components:
> - `ui/Lightbox.vue`: Supports PDF preview, keyboard navigation, file type detection.
> - `common/Lightbox.vue`: Supports zoom/rotate, download event emission.
>
> **Proposed:** Merge zoom/rotate into `ui/Lightbox.vue` (the more complete one) and delete `common/Lightbox.vue`. This requires updating `OrderDetail.vue` import path.

> [!NOTE]
> **Skeleton Enhancement:** Instead of creating new skeleton templates, we will enhance the existing `Skeleton.vue` by adding a `template` prop with presets like `stat-card`, `list-item`, `grid-card`.

---

## Task 1: Unify Lightbox Component

**Files:**
- Modify: [Lightbox.vue](file:///Users/kayla/Downloads/Code/KK-Image/src/components/ui/Lightbox.vue)
- Delete: `src/components/common/Lightbox.vue`
- Modify: [OrderDetail.vue](file:///Users/kayla/Downloads/Code/KK-Image/src/components/order/OrderDetail.vue) (update import path)

### UI/UX Enhancements for Lightbox
- ✅ Add `cursor-zoom-in` on zoomable images
- ✅ Add `cursor-grab` / `cursor-grabbing` for pan operation (future)
- ✅ Use SVG icons for zoom/rotate buttons (no emoji)
- ✅ Add `aria-label` to all icon buttons
- ✅ Smooth zoom animation with `transition-transform duration-200`
- ✅ Keyboard shortcuts: `+/-` for zoom, `R` for rotate

**Step 1:** Add zoom/rotate state and methods to `ui/Lightbox.vue`
```javascript
// Add to script setup
const scale = ref(1);
const rotation = ref(0);

const zoomIn = () => { if (scale.value < 3) scale.value += 0.5; };
const zoomOut = () => { if (scale.value > 0.5) scale.value -= 0.5; };
const rotate = () => { rotation.value = (rotation.value + 90) % 360; };

// Reset on file change
watch(() => props.currentFile, () => {
  scale.value = 1;
  rotation.value = 0;
});

// Enhanced keyboard handler
const handleKeydown = (e) => {
  if (!props.visible) return;
  switch (e.key) {
    case 'Escape': emit('close'); break;
    case 'ArrowLeft': emit('prev'); break;
    case 'ArrowRight': emit('next'); break;
    case '+':
    case '=': zoomIn(); break;
    case '-': zoomOut(); break;
    case 'r':
    case 'R': rotate(); break;
  }
};
```

**Step 2:** Add zoom/rotate toolbar with accessible SVG buttons
```vue
<!-- Zoom/Rotate Toolbar -->
<div class="flex items-center gap-2">
  <!-- Rotate -->
  <button
    type="button"
    class="flex size-10 cursor-pointer items-center justify-center rounded-full bg-white/10 text-white/70 backdrop-blur-md transition-all duration-200 hover:bg-white/20 hover:text-white focus-visible:ring-2 focus-visible:ring-white"
    aria-label="Rotate image"
    @click.stop="rotate"
  >
    <svg class="size-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
    </svg>
  </button>

  <!-- Zoom In -->
  <button
    type="button"
    class="flex size-10 cursor-pointer items-center justify-center rounded-full bg-white/10 text-white/70 backdrop-blur-md transition-all duration-200 hover:bg-white/20 hover:text-white focus-visible:ring-2 focus-visible:ring-white"
    aria-label="Zoom in"
    @click.stop="zoomIn"
  >
    <svg class="size-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
    </svg>
  </button>

  <!-- Zoom Out -->
  <button
    type="button"
    class="flex size-10 cursor-pointer items-center justify-center rounded-full bg-white/10 text-white/70 backdrop-blur-md transition-all duration-200 hover:bg-white/20 hover:text-white focus-visible:ring-2 focus-visible:ring-white"
    aria-label="Zoom out"
    @click.stop="zoomOut"
  >
    <svg class="size-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM13 10H7" />
    </svg>
  </button>

  <!-- Zoom indicator -->
  <span class="min-w-12 text-center text-sm font-medium text-white/70">
    {{ Math.round(scale * 100) }}%
  </span>
</div>
```

**Step 3:** Apply transform to `<img>` element with smooth transition
```html
<img
  ...
  class="max-h-full max-w-full cursor-zoom-in object-contain transition-transform duration-200"
  :style="{ transform: `scale(${scale}) rotate(${rotation}deg)` }"
/>
```

**Step 4:** Update `OrderDetail.vue` import
```diff
-import Lightbox from '@/components/common/Lightbox.vue';
+import Lightbox from '@/components/ui/Lightbox.vue';
```

**Step 5:** Delete `src/components/common/Lightbox.vue`

**Step 6:** Verify in browser that both Gallery and OrderDetail work

---

## Task 2: Create AppStatCard Component

**Files:**
- Create: [AppStatCard.vue](file:///Users/kayla/Downloads/Code/KK-Image/src/components/ui/AppStatCard.vue)

**Analysis:** The stat card pattern is used in:
- `Stats.vue` (via `StatsCard.vue`)
- `SpaceAnalytics.vue` (inline)

### UI/UX Enhancements for AppStatCard
- ✅ Use `-translate-y-1` instead of `scale` for hover (no layout shift)
- ✅ Add `cursor-default` to non-interactive cards
- ✅ Add optional `clickable` prop with `cursor-pointer` and `active:scale-[0.98]`
- ✅ Support icon slot with consistent `size-6` sizing
- ✅ Add loading state with skeleton animation

**Step 1:** Create `AppStatCard.vue` with enhanced props
```vue
<template>
  <div
    class="group rounded-2xl border p-4 shadow-sm transition-all duration-200"
    :class="[
      variantClass,
      clickable
        ? 'cursor-pointer hover:-translate-y-1 hover:shadow-lg active:scale-[0.98]'
        : 'hover:-translate-y-0.5 hover:shadow-md'
    ]"
    @click="clickable && $emit('click')"
  >
    <!-- Loading State -->
    <template v-if="loading">
      <div class="animate-pulse">
        <div class="mb-2 h-4 w-16 rounded bg-[var(--border-color)]" />
        <div class="h-8 w-24 rounded bg-[var(--border-color)]" />
      </div>
    </template>

    <!-- Content -->
    <template v-else>
      <div class="mb-1 flex items-center gap-2">
        <!-- Icon Slot -->
        <slot name="icon">
          <div v-if="icon" class="size-6" :class="labelClass">
            <component :is="icon" class="size-full" />
          </div>
        </slot>
        <span class="text-sm font-medium" :class="labelClass">
          <slot name="label">{{ label }}</slot>
        </span>
      </div>

      <div class="text-2xl font-bold tabular-nums text-[var(--text-main)]">
        <slot>{{ formattedValue }}</slot>
      </div>

      <!-- Trend/Footer -->
      <div v-if="$slots.footer || trend" class="mt-2 flex items-center gap-1 text-xs">
        <template v-if="trend">
          <span :class="trend > 0 ? 'text-[var(--color-success)]' : 'text-[var(--color-danger)]'">
            {{ trend > 0 ? '↑' : '↓' }} {{ Math.abs(trend) }}%
          </span>
          <span class="text-[var(--text-secondary)]">vs last period</span>
        </template>
        <slot name="footer" />
      </div>
    </template>
  </div>
</template>

<script setup>
import { computed } from 'vue';

const props = defineProps({
  label: { type: String, default: '' },
  value: { type: [String, Number], default: '' },
  variant: {
    type: String,
    default: 'default',
    validator: v => ['default', 'info', 'purple', 'success', 'warning', 'danger', 'cyan'].includes(v),
  },
  clickable: { type: Boolean, default: false },
  loading: { type: Boolean, default: false },
  trend: { type: Number, default: null }, // percentage change
  icon: { type: [Object, Function], default: null },
});

defineEmits(['click']);

const formattedValue = computed(() => {
  if (typeof props.value === 'number') {
    return props.value.toLocaleString();
  }
  return props.value;
});

const variantClass = computed(() => {
  const variants = {
    default: 'border-[var(--border-color)] bg-[var(--bg-card)]',
    info: 'border-[var(--color-info)]/20 bg-[var(--color-info)]/5',
    purple: 'border-[var(--color-purple)]/20 bg-[var(--color-purple)]/5',
    success: 'border-[var(--color-success)]/20 bg-[var(--color-success)]/5',
    warning: 'border-[var(--color-warning)]/20 bg-[var(--color-warning)]/5',
    danger: 'border-[var(--color-danger)]/20 bg-[var(--color-danger)]/5',
    cyan: 'border-[var(--color-cyan)]/20 bg-[var(--color-cyan)]/5',
  };
  return variants[props.variant] || variants.default;
});

const labelClass = computed(() => {
  const labels = {
    default: 'text-[var(--text-secondary)]',
    info: 'text-[var(--color-info)]',
    purple: 'text-[var(--color-purple)]',
    success: 'text-[var(--color-success)]',
    warning: 'text-[var(--color-warning)]',
    danger: 'text-[var(--color-danger)]',
    cyan: 'text-[var(--color-cyan)]',
  };
  return labels[props.variant] || labels.default;
});
</script>
```

**Step 2:** Replace inline stat cards in `SpaceAnalytics.vue` with `AppStatCard`

**Step 3:** Verify SpaceAnalytics still renders correctly

---

## Task 3: Enhance Skeleton Component with Templates

**Files:**
- Modify: [Skeleton.vue](file:///Users/kayla/Downloads/Code/KK-Image/src/components/ui/Skeleton.vue)

### UI/UX Enhancements for Skeleton
- ✅ Use subtle shimmer animation (not harsh pulse)
- ✅ Match exact dimensions of real content to prevent layout shift
- ✅ Support `prefers-reduced-motion` by disabling animation
- ✅ Add `aria-label="Loading..."` for screen readers

**Step 1:** Add `template` prop with presets
```javascript
const props = defineProps({
  // ... existing props
  template: {
    type: String,
    default: null,
    validator: v => [null, 'stat-card', 'list-card', 'avatar', 'text-line'].includes(v),
  },
  count: { type: Number, default: 1 }, // Repeat count
});
```

**Step 2:** Add template-based rendering with reduced-motion support
```vue
<template>
  <div role="status" aria-label="Loading...">
    <template v-for="i in count" :key="i">
      <!-- Existing simple skeleton -->
      <div
        v-if="!template"
        class="skeleton-shimmer rounded bg-[var(--bg-muted)]"
        :class="sizeClass"
      />

      <!-- Stat Card Template -->
      <div
        v-else-if="template === 'stat-card'"
        class="skeleton-shimmer rounded-xl border border-[var(--border-color)] bg-[var(--bg-muted)] p-4"
      >
        <div class="mb-2 h-4 w-16 rounded bg-[var(--border-color)]" />
        <div class="h-8 w-24 rounded bg-[var(--border-color)]" />
      </div>

      <!-- List Card Template -->
      <div
        v-else-if="template === 'list-card'"
        class="skeleton-shimmer rounded-xl border border-[var(--border-color)] bg-[var(--bg-card)] p-4"
      >
        <div class="flex gap-3">
          <div class="size-16 flex-shrink-0 rounded-lg bg-[var(--bg-muted)]" />
          <div class="flex-1 space-y-2">
            <div class="h-4 w-3/4 rounded bg-[var(--bg-muted)]" />
            <div class="h-3 w-1/2 rounded bg-[var(--bg-muted)]" />
            <div class="h-3 w-1/3 rounded bg-[var(--bg-muted)]" />
          </div>
        </div>
      </div>

      <!-- Avatar Template -->
      <div
        v-else-if="template === 'avatar'"
        class="skeleton-shimmer size-10 rounded-full bg-[var(--bg-muted)]"
      />
    </template>
  </div>
</template>

<style scoped>
.skeleton-shimmer {
  animation: shimmer 1.5s infinite;
  background: linear-gradient(
    90deg,
    var(--bg-muted) 0%,
    var(--bg-hover) 50%,
    var(--bg-muted) 100%
  );
  background-size: 200% 100%;
}

@keyframes shimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}

@media (prefers-reduced-motion: reduce) {
  .skeleton-shimmer {
    animation: none;
    background: var(--bg-muted);
  }
}
</style>
```

**Step 3:** Update `OrderCards.vue` and `CustomerCards.vue` to use `<Skeleton template="list-card" :count="5" />`

**Step 4:** Verify loading states render correctly

---

## Pre-Delivery Checklist

Before considering each task complete, verify:

### Visual Quality
- [ ] No emojis used as icons (use SVG instead)
- [ ] All icons from consistent icon set (Heroicons style)
- [ ] Hover states don't cause layout shift
- [ ] Transitions are 150-300ms

### Interaction
- [ ] All clickable elements have `cursor-pointer`
- [ ] Hover states provide clear visual feedback
- [ ] Focus states visible for keyboard navigation

### Light/Dark Mode
- [ ] Components visible in both light and dark modes
- [ ] Text has sufficient contrast (4.5:1 minimum)
- [ ] Borders visible in both modes

### Accessibility
- [ ] Icon-only buttons have `aria-label`
- [ ] Keyboard shortcuts work (Lightbox: Escape, arrows, +/-, R)
- [ ] `prefers-reduced-motion` respected for animations

---

## Verification Plan

### Manual Verification
1. **Lightbox:** Open an order with images, click to open lightbox, test:
   - Zoom in/out with buttons and `+`/`-` keys
   - Rotate with button and `R` key
   - Navigate with arrows and keyboard
   - Verify zoom indicator shows percentage
2. **Lightbox:** Open Gallery, test PDF preview and image navigation
3. **AppStatCard:** View SpaceAnalytics modal, confirm:
   - Cards render correctly with colored variants
   - Hover effect is `-translate-y-1` (no scale)
   - Numbers are formatted with `toLocaleString()`
4. **Skeleton:** Navigate to Order/Customer lists, confirm:
   - Skeleton matches real content dimensions
   - Shimmer animation is subtle
   - Animation respects `prefers-reduced-motion`

### Automated Tests
- None required for UI components in this project's current test setup.
