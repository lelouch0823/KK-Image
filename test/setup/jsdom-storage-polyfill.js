/**
 * vitest 全局 setup：jsdom Web Storage 兜底。
 *
 * jsdom 27 + vitest VM 上下文组合下（Node 26 实测），window 上的
 * localStorage/sessionStorage getter 会返回 undefined（裸 JSDOM 实例正常，
 * 仅经 vitest populateGlobal 的 VM 路径失效）。这里在检测到缺失时注入
 * 与 jsdom 同语义的内存 Storage，恢复浏览器环境对等——仅影响测试环境，
 * 不触碰产品代码。
 */

class MemoryStorage {
  constructor() {
    this._data = new Map();
  }
  get length() {
    return this._data.size;
  }
  clear() {
    this._data.clear();
  }
  getItem(key) {
    const value = this._data.get(String(key));
    return value === undefined ? null : value;
  }
  key(index) {
    return Array.from(this._data.keys())[Number(index)] ?? null;
  }
  removeItem(key) {
    this._data.delete(String(key));
  }
  setItem(key, value) {
    this._data.set(String(key), String(value));
  }
}

function ensureStorage(name) {
  const existing = globalThis[name];
  if (existing !== undefined && existing !== null) return;
  try {
    Object.defineProperty(globalThis, name, {
      configurable: true,
      writable: true,
      value: new MemoryStorage(),
    });
  } catch {
    // 极端环境（只读全局）下放弃——测试会显式暴露缺失
  }
}

ensureStorage('localStorage');
ensureStorage('sessionStorage');
