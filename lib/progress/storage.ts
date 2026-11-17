import type { TelegramWebApp } from "@/lib/telegram";

export interface KV {
  // Returns only the keys that exist.
  get(keys: string[]): Promise<Record<string, string>>;
  set(key: string, value: string): Promise<void>;
}

const PREFIX = "dpr:";
const CLOUD_TIMEOUT_MS = 5000;

// localStorage can throw (private mode, blocked site data): reads give nothing, writes are dropped.
export const localKV: KV = {
  async get(keys) {
    const out: Record<string, string> = {};
    try {
      for (const k of keys) {
        const v = localStorage.getItem(PREFIX + k);
        if (v !== null) out[k] = v;
      }
    } catch {
      return {};
    }
    return out;
  },
  async set(key, value) {
    try {
      localStorage.setItem(PREFIX + key, value);
    } catch {
      // shortcut: a failed local write is silent, the cloud copy and in-memory state still hold it
    }
  },
};

// A callback that never fires must not hang the UI.
function callback<T>(call: (cb: (err: string | null, v?: T) => void) => void) {
  return new Promise<T | undefined>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error("CloudStorage timeout")),
      CLOUD_TIMEOUT_MS,
    );
    try {
      call((err, v) => {
        clearTimeout(timer);
        if (err) reject(new Error(err));
        else resolve(v);
      });
    } catch (e) {
      clearTimeout(timer);
      reject(e);
    }
  });
}

export function cloudKV(tg: TelegramWebApp | null): KV | null {
  const cs = tg?.CloudStorage;
  if (!cs) return null;
  return {
    async get(keys) {
      if (keys.length === 0) return {};
      const values = await callback<Record<string, string>>((cb) =>
        cs.getItems(keys, cb),
      );
      // CloudStorage answers a missing key with an empty string.
      return Object.fromEntries(
        Object.entries(values ?? {}).filter(([, v]) => v !== ""),
      );
    },
    async set(key, value) {
      await callback<boolean>((cb) => cs.setItem(key, value, cb));
    },
  };
}
