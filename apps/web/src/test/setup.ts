import "@testing-library/jest-dom/vitest";

// Node 25's experimental native `localStorage` global (gated behind --localstorage-file,
// which is unset here) shadows jsdom's window.localStorage with a non-functional stub —
// window.localStorage === globalThis.localStorage in this environment, and neither has a
// working setItem/getItem. Replace both with a minimal in-memory Storage polyfill so code
// under test (api/client.ts, state/auth-context.tsx) gets a real, working store.
class MemoryStorage implements Storage {
  private store = new Map<string, string>();
  get length() {
    return this.store.size;
  }
  clear() {
    this.store.clear();
  }
  getItem(key: string) {
    return this.store.has(key) ? this.store.get(key)! : null;
  }
  key(index: number) {
    return Array.from(this.store.keys())[index] ?? null;
  }
  removeItem(key: string) {
    this.store.delete(key);
  }
  setItem(key: string, value: string) {
    this.store.set(key, String(value));
  }
}

const memoryStorage = new MemoryStorage();
for (const target of [globalThis, window] as const) {
  Object.defineProperty(target, "localStorage", { value: memoryStorage, configurable: true });
}
