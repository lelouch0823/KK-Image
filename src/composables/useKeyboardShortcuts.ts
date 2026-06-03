/**
 * useKeyboardShortcuts - 全局键盘快捷键注册与管理系统
 *
 * 功能：
 * - 模块级单例模式，全局共享快捷键注册表
 * - register / unregister 注册与注销快捷键
 * - shortcuts 计算属性列出所有已注册快捷键（供帮助弹窗使用）
 * - enabled 开关控制全局快捷键启用/禁用
 * - 自动跳过 input / textarea / contenteditable 等输入元素
 * - 支持 Mod（⌘ on Mac, Ctrl on Windows/Linux）修饰键
 * - 与 useMagicKeys 集成
 *
 * 使用方式（全局单例）：
 * const { register, unregister, shortcuts, enabled } = useKeyboardShortcuts();
 */
import { ref, computed, onScopeDispose } from 'vue';
import { useMagicKeys } from '@vueuse/core';

// ---------- 类型定义 ----------

/** 快捷键修饰键 */
export interface ShortcutModifiers {
  meta?: boolean; // ⌘ on Mac
  ctrl?: boolean;
  shift?: boolean;
  alt?: boolean;
}

/** 快捷键注册项 */
export interface ShortcutItem {
  id: string;
  key: string;           // 按键名（不含修饰键），如 'k', 'n', '?', '/'
  modifiers: ShortcutModifiers;
  callback: (event: KeyboardEvent) => void;
  description: string;   // 快捷键描述（i18n key 或直接文本）
  category: 'general' | 'navigation' | 'actions' | 'editing';
  /** 是否覆盖默认行为（如 Escape 已由 Modal 处理） */
  overrideDefault?: boolean;
  /** 快捷键的 i18n 描述路径 */
  i18nKey?: string;
}

/** 快捷键字符串格式：'Mod+k', 'Mod+Shift+n', 'Escape', '?' 等 */
export type ShortcutString = string;

// ---------- 全局单例状态 ----------

const shortcutsMap = ref<Map<string, ShortcutItem>>(new Map());
const enabled = ref(true);

// useMagicKeys 在模块级别调用，全局共享
const keys = useMagicKeys();

// ---------- 输入元素检测 ----------

/** 判断当前焦点是否在输入元素中 */
function isInInputElement(): boolean {
  const el = document.activeElement;
  if (!el) return false;
  const tag = el.tagName.toLowerCase();
  if (tag === 'input' || tag === 'textarea' || tag === 'select') return true;
  if ((el as HTMLElement).isContentEditable) return true;
  // 搜索框等 role=search 的元素
  if (el.getAttribute('role') === 'searchbox') return true;
  return false;
}

// ---------- 快捷键字符串解析 ----------

/** 将快捷键字符串解析为 key + modifiers */
function parseShortcutString(str: ShortcutString): { key: string; modifiers: ShortcutModifiers } {
  const parts = str.split('+').map((p) => p.trim());
  const modifiers: ShortcutModifiers = {
    meta: false,
    ctrl: false,
    shift: false,
    alt: false,
  };
  let key = '';

  for (const part of parts) {
    switch (part) {
      case 'Mod':
        modifiers.meta = true;
        break;
      case 'Cmd':
        modifiers.meta = true;
        break;
      case 'Ctrl':
        modifiers.ctrl = true;
        break;
      case 'Shift':
        modifiers.shift = true;
        break;
      case 'Alt':
        modifiers.alt = true;
        break;
      default:
        key = part.toLowerCase();
    }
  }

  return { key, modifiers };
}

// ---------- 主 composable ----------

export function useKeyboardShortcuts() {
  // ---------- 注册 / 注销 ----------

  const register = (
    id: string,
    shortcut: ShortcutString | { key: string } & ShortcutModifiers,
    callback: (event: KeyboardEvent) => void,
    options?: {
      description?: string;
      category?: ShortcutItem['category'];
      overrideDefault?: boolean;
      i18nKey?: string;
    },
  ) => {
    let key: string;
    let modifiers: ShortcutModifiers;

    if (typeof shortcut === 'string') {
      const parsed = parseShortcutString(shortcut);
      key = parsed.key;
      modifiers = parsed.modifiers;
    } else {
      key = shortcut.key.toLowerCase();
      modifiers = {
        meta: shortcut.meta,
        ctrl: shortcut.ctrl,
        shift: shortcut.shift,
        alt: shortcut.alt,
      };
    }

    shortcutsMap.value.set(id, {
      id,
      key,
      modifiers,
      callback,
      description: options?.description ?? id,
      category: options?.category ?? 'general',
      overrideDefault: options?.overrideDefault,
      i18nKey: options?.i18nKey,
    });
  };

  const unregister = (id: string) => {
    shortcutsMap.value.delete(id);
  };

  // ---------- 快捷键列表（供帮助弹窗） ----------

  const shortcuts = computed<ShortcutItem[]>(() => {
    return Array.from(shortcutsMap.value.values());
  });

  // ---------- 键盘事件监听 ----------

  const handleKeydown = (event: KeyboardEvent) => {
    if (!enabled.value) return;

    // 输入元素中不触发（除非是 Escape 键 -- 由 Modal 自行处理）
    if (isInInputElement() && event.key !== 'Escape') return;

    // 遍历已注册快捷键，查找匹配
    for (const shortcut of shortcutsMap.value.values()) {
      const { key, modifiers } = shortcut;

      // 匹配主键
      const eventKey = event.key.toLowerCase();
      const matchKey = eventKey === key || event.code.toLowerCase() === key;

      if (!matchKey) continue;

      // 匹配修饰键
      const modMatch =
        (modifiers.meta ?? false) === (event.metaKey || event.ctrlKey) &&
        (modifiers.ctrl ?? false) === event.ctrlKey &&
        (modifiers.shift ?? false) === event.shiftKey &&
        (modifiers.alt ?? false) === event.altKey;

      if (!modMatch) continue;

      // 特殊处理 Mod 键：Mac 上是 metaKey，Windows/Linux 上是 ctrlKey
      // Mod=true 时，metaKey 或 ctrlKey 都算匹配
      if (modifiers.meta && !modifiers.ctrl) {
        if (!(event.metaKey || event.ctrlKey)) continue;
      }

      // 触发回调
      if (shortcut.overrideDefault) {
        event.preventDefault();
      }
      shortcut.callback(event);
      return; // 只触发第一个匹配的快捷键
    }
  };

  // 挂载全局 keydown 监听
  const attachListener = () => {
    document.addEventListener('keydown', handleKeydown, { capture: true });
  };

  const detachListener = () => {
    document.removeEventListener('keydown', handleKeydown, { capture: true });
  };

  // 使用 VueUse 的 whenever 监听快捷键组合
  // 这是为了兼容 useMagicKeys 的组合键监听方式
  const setupMagicKeysListeners = () => {
    // 由外部调用方（如 App.vue）直接使用 keys 对象监听
    // 此处仅提供 handleKeydown 作为备用方案
  };

  // 清理
  onScopeDispose(() => {
    detachListener();
  });

  return {
    /** 已注册快捷键列表 */
    shortcuts,
    /** 全局启用/禁用开关 */
    enabled,
    /** 注册快捷键 */
    register,
    /** 注销快捷键 */
    unregister,
    /** 键盘事件处理器（手动挂载用） */
    handleKeydown,
    /** 挂载全局监听 */
    attachListener,
    /** 移除全局监听 */
    detachListener,
    /** useMagicKeys 返回的 keys 对象（可用于组合键监听） */
    keys,
    /** 判断当前是否在输入元素中 */
    isInInputElement,
  };
}
