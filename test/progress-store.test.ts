import { afterEach, describe, expect, it, vi } from "vitest";
import { cloudKV, localKV, type KV } from "@/lib/progress/storage";
import { createStore } from "@/lib/progress/store";
import type { TelegramWebApp } from "@/lib/telegram";

type Fake = KV & {
  data: Record<string, string>;
  gets: string[][];
  sets: [string, string][];
  failSet: boolean;
  failGet: boolean;
};

function fake(init: Record<string, string> = {}): Fake {
  const f: Fake = {
    data: { ...init },
    gets: [],
    sets: [],
    failSet: false,
    failGet: false,
    async get(keys) {
      f.gets.push(keys);
      if (f.failGet) throw new Error("get failed");
      return Object.fromEntries(
        keys.filter((k) => k in f.data).map((k) => [k, f.data[k]]),
      );
    },
    async set(key, value) {
      if (f.failSet) throw new Error("set failed");
      f.sets.push([key, value]);
      f.data[key] = value;
    },
  };
  return f;
}

const clock =
  (t = 1000) =>
  () =>
    t;

describe("createStore.load", () => {
  it("asks for exactly the done chunks, quiz keys and lang, nothing else", async () => {
    const local = fake();
    const cloud = fake();
    await createStore(local, cloud, clock()).load(["m1", "m2"], ["m1-q"]);
    const expected = [
      "done-m1",
      "done-m1-2",
      "done-m1-3",
      "done-m2",
      "done-m2-2",
      "done-m2-3",
      "quiz-m1-q",
      "lang",
    ];
    expect(local.gets).toEqual([expected]);
    expect(cloud.gets).toEqual([expected]);
  });

  it("merges local and cloud (latest write wins) and writes the result back to both", async () => {
    const local = fake({ "done-m": '{"a":10,"c":5}', "quiz-m-q": "3/5" });
    const cloud = fake({ "done-m": '{"a":-20,"b":5}', "quiz-m-q": "4/5" });
    const store = createStore(local, cloud, clock());
    const snap = await store.load(["m"], ["m-q"]);
    expect(snap.done.m).toEqual({ a: -20, b: 5, c: 5 });
    expect(snap.quizzes["m-q"]).toBe("4/5");
    expect(JSON.parse(local.data["done-m"])).toEqual({ a: -20, b: 5, c: 5 });
    expect(JSON.parse(cloud.data["done-m"])).toEqual({ a: -20, b: 5, c: 5 });
    expect(local.data["quiz-m-q"]).toBe("4/5");
    expect(store.getSnapshot()).toBe(snap);
    expect(store.synced()).toBe(true);
  });

  it("writes only what differs", async () => {
    const same = { "done-m": '{"a":10}', "quiz-m-q": "3/5", lang: "ru" };
    const local = fake(same);
    const cloud = fake({ ...same, "done-m": '{"a":10}' });
    await createStore(local, cloud, clock()).load(["m"], ["m-q"]);
    expect(local.sets).toEqual([]);
    expect(cloud.sets).toEqual([]);

    const local2 = fake({ "done-m": '{"a":10,"b":3}' });
    const cloud2 = fake({ "done-m": '{"a":10}' });
    await createStore(local2, cloud2, clock()).load(["m"], []);
    expect(local2.sets).toEqual([]);
    expect(cloud2.sets).toHaveLength(1);
  });

  it("does not rewrite a store whose value only differs in key order", async () => {
    const local = fake({ "done-m": '{"a":1,"b":2}' });
    const cloud = fake({ "done-m": '{"b":2,"a":1}' });
    await createStore(local, cloud, clock()).load(["m"], []);
    expect(local.sets).toEqual([]);
    expect(cloud.sets).toEqual([]);
  });

  it("does not write empty modules", async () => {
    const local = fake();
    const cloud = fake();
    await createStore(local, cloud, clock()).load(["m"], ["m-q"]);
    expect(local.sets).toEqual([]);
    expect(cloud.sets).toEqual([]);
  });

  it("ignores garbage per key without breaking the rest", async () => {
    const local = fake({
      "done-m": "not json",
      "done-m-2": '{"b":2}',
      "done-n": "[1,2]",
      "done-o": '{"a":"x"}',
      "quiz-m-q": "мусор",
      "quiz-m-r": "1/2",
    });
    const cloud = fake({ "quiz-m-q": "2/3" });
    const snap = await createStore(local, cloud, clock()).load(
      ["m", "n", "o"],
      ["m-q", "m-r"],
    );
    expect(snap.done.m).toEqual({ b: 2 });
    expect(snap.done.n).toEqual({});
    expect(snap.done.o).toEqual({});
    expect(snap.quizzes).toEqual({ "m-q": "2/3", "m-r": "1/2" });
    expect(local.data["quiz-m-q"]).toBe("2/3");
  });

  it("keeps unknown slugs in the snapshot and writes them back", async () => {
    const local = fake({ "done-m": '{"ghost":4}' });
    const cloud = fake({ "done-m": '{"a":5}' });
    const snap = await createStore(local, cloud, clock()).load(["m"], []);
    expect(snap.done.m).toEqual({ ghost: 4, a: 5 });
    expect(JSON.parse(cloud.data["done-m"])).toEqual({ ghost: 4, a: 5 });
  });

  it("lang: local wins, cloud fills a missing local and vice versa", async () => {
    const a = fake({ lang: "en" });
    const ca = fake({ lang: "ru" });
    expect((await createStore(a, ca, clock()).load([], [])).lang).toBe("en");
    expect(ca.data.lang).toBe("ru"); // differing values are never overwritten

    const b = fake();
    const cb = fake({ lang: "ru" });
    expect((await createStore(b, cb, clock()).load([], [])).lang).toBe("ru");
    expect(b.data.lang).toBe("ru");

    const c = fake({ lang: "en" });
    const cc = fake();
    await createStore(c, cc, clock()).load([], []);
    expect(cc.data.lang).toBe("en");
  });

  it("un-mark on the other device (later) wins after load", async () => {
    const local = fake({ "done-m": '{"a":100}' });
    const cloud = fake({ "done-m": '{"a":-200}' });
    const snap = await createStore(local, cloud, clock()).load(["m"], []);
    expect(snap.done.m).toEqual({ a: -200 });
  });

  it("when the cloud read fails: uses local, synced false, never writes to the cloud", async () => {
    const local = fake({ "done-m": '{"a":1}' });
    const cloud = fake({ "done-m": '{"b":2}' });
    cloud.failGet = true;
    const store = createStore(local, cloud, clock());
    const snap = await store.load(["m"], []);
    expect(snap.done.m).toEqual({ a: 1 });
    expect(store.synced()).toBe(false);
    expect(cloud.sets).toEqual([]);
  });

  it("when a cloud writeback fails: synced false, no exception", async () => {
    const local = fake({ "done-m": '{"a":1}' });
    const cloud = fake();
    cloud.failSet = true;
    const store = createStore(local, cloud, clock());
    await expect(store.load(["m"], [])).resolves.toBeDefined();
    expect(store.synced()).toBe(false);
  });

  it("works with cloud === null and keeps synced true", async () => {
    const local = fake({ "done-m": '{"a":1}' });
    const store = createStore(local, null, clock());
    const snap = await store.load(["m"], []);
    expect(snap.done.m).toEqual({ a: 1 });
    expect(store.synced()).toBe(true);
  });
});

describe("createStore.markLesson / saveQuiz / setLang", () => {
  it("markLesson writes local then cloud and updates the snapshot", async () => {
    const local = fake();
    const cloud = fake();
    const store = createStore(local, cloud, clock(1000));
    await store.load(["m"], []);
    await store.markLesson("m", "a", true);
    expect(store.getSnapshot().done.m).toEqual({ a: 1000 });
    expect(JSON.parse(local.data["done-m"])).toEqual({ a: 1000 });
    expect(JSON.parse(cloud.data["done-m"])).toEqual({ a: 1000 });
    await store.markLesson("m", "a", false);
    expect(store.getSnapshot().done.m).toEqual({ a: -1001 });
  });

  it("a cloud failure leaves local and the snapshot updated, synced false; a later success restores it", async () => {
    const local = fake();
    const cloud = fake();
    const store = createStore(local, cloud, clock());
    await store.load(["m"], []);
    cloud.failSet = true;
    await expect(store.markLesson("m", "a", true)).resolves.toBeUndefined();
    expect(store.synced()).toBe(false);
    expect(store.getSnapshot().done.m).toEqual({ a: 1000 });
    expect(JSON.parse(local.data["done-m"])).toEqual({ a: 1000 });
    expect(cloud.data["done-m"]).toBeUndefined();
    cloud.failSet = false;
    await store.markLesson("m", "b", true);
    expect(store.synced()).toBe(true);
    expect(JSON.parse(cloud.data["done-m"])).toEqual({ a: 1000, b: 1000 });
  });

  it("a local write failure does not escape either", async () => {
    const local = fake();
    local.failSet = true;
    const cloud = fake();
    const store = createStore(local, cloud, clock());
    await store.load(["m"], []);
    await expect(store.markLesson("m", "a", true)).resolves.toBeUndefined();
    expect(JSON.parse(cloud.data["done-m"])).toEqual({ a: 1000 });
  });

  it("with cloud === null synced stays true", async () => {
    const store = createStore(fake(), null, clock());
    await store.load(["m"], []);
    await store.markLesson("m", "a", true);
    expect(store.synced()).toBe(true);
  });

  it("saveQuiz never lowers a stored result", async () => {
    const local = fake();
    const cloud = fake();
    const store = createStore(local, cloud, clock());
    await store.load([], ["m-q"]);
    await store.saveQuiz("m", "q", 5, 5);
    expect(store.getSnapshot().quizzes["m-q"]).toBe("5/5");
    local.sets.length = 0;
    cloud.sets.length = 0;
    await store.saveQuiz("m", "q", 4, 5);
    expect(store.getSnapshot().quizzes["m-q"]).toBe("5/5");
    expect(local.data["quiz-m-q"]).toBe("5/5");
    expect(local.sets).toEqual([]);
    expect(cloud.sets).toEqual([]);
  });

  it("saveQuiz stores a first result and a higher one", async () => {
    const local = fake();
    const cloud = fake();
    const store = createStore(local, cloud, clock());
    await store.load([], []);
    await store.saveQuiz("m", "q", 2, 5);
    expect(local.data["quiz-m-q"]).toBe("2/5");
    expect(cloud.data["quiz-m-q"]).toBe("2/5");
    await store.saveQuiz("m", "q", 4, 5);
    expect(cloud.data["quiz-m-q"]).toBe("4/5");
  });

  it("setLang stores the language in both stores", async () => {
    const local = fake();
    const cloud = fake();
    const store = createStore(local, cloud, clock());
    await store.setLang("en");
    expect(store.getSnapshot().lang).toBe("en");
    expect(local.data.lang).toBe("en");
    expect(cloud.data.lang).toBe("en");
  });
});

// A KV whose get answers only after `release()` is called, with the data as of the call.
function slow(base: Fake) {
  let release!: () => void;
  const gate = new Promise<void>((r) => (release = r));
  const kv: KV = {
    // the value is read now and delivered late, like a slow network answer
    get: async (keys) => {
      const v = await base.get(keys);
      await gate;
      return v;
    },
    set: (k, v) => base.set(k, v),
  };
  return { kv, release };
}

describe("createStore: load racing with writes", () => {
  it("a mark made while load is pending survives in the snapshot and in both stores", async () => {
    const local = fake({ "done-m": '{"old":5}' });
    const cloudBase = fake({ "done-m": '{"other":6}' });
    const { kv, release } = slow(cloudBase);
    const store = createStore(local, kv, clock(1000));
    const loading = store.load(["m"], []);
    const marking = store.markLesson("m", "a", true);
    expect(store.getSnapshot().done.m).toEqual({ a: 1000 }); // visible at once
    release();
    await Promise.all([loading, marking]);
    const want = { old: 5, other: 6, a: 1000 };
    expect(store.getSnapshot().done.m).toEqual(want);
    expect(JSON.parse(local.data["done-m"])).toEqual(want);
    expect(JSON.parse(cloudBase.data["done-m"])).toEqual(want);
    expect(store.synced()).toBe(true);
  });

  it("a quiz result saved while load is pending survives too", async () => {
    const local = fake({ "quiz-m-q": "1/5" });
    const cloudBase = fake();
    const { kv, release } = slow(cloudBase);
    const store = createStore(local, kv, clock());
    const loading = store.load([], ["m-q"]);
    const saving = store.saveQuiz("m", "q", 4, 5);
    release();
    await Promise.all([loading, saving]);
    expect(store.getSnapshot().quizzes["m-q"]).toBe("4/5");
    expect(local.data["quiz-m-q"]).toBe("4/5");
    expect(cloudBase.data["quiz-m-q"]).toBe("4/5");
  });

  it("a language chosen while load is pending is not replaced", async () => {
    const local = fake({ lang: "ru" });
    const cloudBase = fake();
    const { kv, release } = slow(cloudBase);
    const store = createStore(local, kv, clock());
    const loading = store.load([], []);
    const setting = store.setLang("en");
    release();
    await Promise.all([loading, setting]);
    expect(store.getSnapshot().lang).toBe("en");
    expect(local.data.lang).toBe("en");
  });
});

describe("createStore: merge on write", () => {
  const seed = { "done-m": '{"x":10,"y":50}' };

  it("two devices: both devices' changes end up in the cloud", async () => {
    const cloud = fake(seed);
    const a = createStore(fake(seed), cloud, clock(100));
    const b = createStore(fake(seed), cloud, clock(200));
    await a.load(["m"], []);
    await b.load(["m"], []); // B's snapshot is now stale for X
    await a.markLesson("m", "x", true); // X done at 100? old 10 -> max(100, 11)
    await b.markLesson("m", "y", false); // Y un-marked at 200
    const want = { x: 100, y: -200 };
    expect(JSON.parse(cloud.data["done-m"])).toEqual(want);
    expect(b.getSnapshot().done.m).toEqual(want);
  });

  it("an un-mark by A (t=300) is not overwritten by B's stale older mark (t=200)", async () => {
    const cloud = fake(seed);
    const a = createStore(fake(seed), cloud, clock(300));
    const b = createStore(fake(seed), cloud, clock(200));
    await a.load(["m"], []);
    await b.load(["m"], []);
    await a.markLesson("m", "y", false); // y: -300
    await b.markLesson("m", "y", true); // stale: would write +200
    expect(JSON.parse(cloud.data["done-m"]).y).toBe(-300);
    expect(b.getSnapshot().done.m.y).toBe(-300);
    expect(b.synced()).toBe(true);
  });

  it("a higher quiz result in the cloud is not lowered by a stale device", async () => {
    const cloud = fake({ "quiz-m-q": "5/5" });
    const b = createStore(fake(), cloud, clock());
    await b.saveQuiz("m", "q", 2, 5);
    expect(cloud.data["quiz-m-q"]).toBe("5/5");
    expect(b.getSnapshot().quizzes["m-q"]).toBe("5/5");
  });

  it("with a failing cloud read: local and snapshot updated, cloud untouched, synced false, no throw", async () => {
    const local = fake();
    const cloud = fake({ "done-m": '{"c":9}' });
    const store = createStore(local, cloud, clock());
    await store.load(["m"], []);
    cloud.sets.length = 0;
    cloud.failGet = true;
    await expect(store.markLesson("m", "a", true)).resolves.toBeUndefined();
    await expect(store.saveQuiz("m", "q", 1, 2)).resolves.toBeUndefined();
    expect(store.getSnapshot().done.m).toEqual({ c: 9, a: 1000 });
    expect(JSON.parse(local.data["done-m"])).toEqual({ c: 9, a: 1000 });
    expect(local.data["quiz-m-q"]).toBe("1/2");
    expect(cloud.sets).toEqual([]);
    expect(cloud.data["done-m"]).toBe('{"c":9}');
    expect(store.synced()).toBe(false);
    cloud.failGet = false;
    await store.markLesson("m", "b", true);
    expect(store.synced()).toBe(true);
    expect(JSON.parse(cloud.data["done-m"])).toEqual({
      c: 9,
      a: 1000,
      b: 1000,
    });
  });
});

describe("createStore.subscribe / getSnapshot", () => {
  it("notifies on changes, stops after unsubscribe, snapshot is stable between changes", async () => {
    const store = createStore(fake(), fake(), clock());
    const fn = vi.fn();
    const off = store.subscribe(fn);
    const s0 = store.getSnapshot();
    expect(store.getSnapshot()).toBe(s0);
    await store.markLesson("m", "a", true);
    expect(fn).toHaveBeenCalled();
    const s1 = store.getSnapshot();
    expect(s1).not.toBe(s0);
    expect(store.getSnapshot()).toBe(s1);
    off();
    fn.mockClear();
    await store.markLesson("m", "b", true);
    expect(fn).not.toHaveBeenCalled();
  });

  it("notifies when load replaces the snapshot", async () => {
    const store = createStore(fake({ "done-m": '{"a":1}' }), null, clock());
    const fn = vi.fn();
    store.subscribe(fn);
    await store.load(["m"], []);
    expect(fn).toHaveBeenCalled();
  });

  it("notifies when synced flips", async () => {
    const cloud = fake();
    const store = createStore(fake(), cloud, clock());
    await store.load([], []);
    const seen: boolean[] = [];
    store.subscribe(() => seen.push(store.synced()));
    cloud.failSet = true;
    await store.setLang("en");
    expect(seen.at(-1)).toBe(false);
  });
});

describe("localKV", () => {
  afterEach(() => vi.unstubAllGlobals());

  function stubStorage() {
    const m = new Map<string, string>();
    vi.stubGlobal("localStorage", {
      getItem: (k: string) => m.get(k) ?? null,
      setItem: (k: string, v: string) => void m.set(k, v),
    });
    return m;
  }

  it("prefixes keys with dpr: and returns only existing keys, unprefixed", async () => {
    const m = stubStorage();
    await localKV.set("a", "1");
    expect(m.get("dpr:a")).toBe("1");
    expect(await localKV.get(["a", "b"])).toEqual({ a: "1" });
  });

  it("swallows exceptions from a blocked localStorage", async () => {
    const boom = () => {
      throw new Error("SecurityError");
    };
    vi.stubGlobal("localStorage", { getItem: boom, setItem: boom });
    await expect(localKV.get(["a"])).resolves.toEqual({});
    await expect(localKV.set("a", "1")).resolves.toBeUndefined();
  });

  it("swallows a throwing localStorage accessor and a missing one", async () => {
    vi.stubGlobal("localStorage", undefined);
    await expect(localKV.get(["a"])).resolves.toEqual({});
    await expect(localKV.set("a", "1")).resolves.toBeUndefined();
    vi.unstubAllGlobals();
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      get() {
        throw new Error("denied");
      },
    });
    try {
      await expect(localKV.get(["a"])).resolves.toEqual({});
      await expect(localKV.set("a", "1")).resolves.toBeUndefined();
    } finally {
      delete (globalThis as Record<string, unknown>).localStorage;
    }
  });
});

describe("cloudKV", () => {
  type Cb<T> = (err: string | null, v?: T) => void;
  const tg = (cs: unknown) =>
    ({ CloudStorage: cs }) as unknown as TelegramWebApp;

  afterEach(() => vi.useRealTimers());

  it("is null without CloudStorage", () => {
    expect(cloudKV(null)).toBeNull();
    expect(cloudKV({} as unknown as TelegramWebApp)).toBeNull();
  });

  it("wraps getItems and drops missing (empty) keys", async () => {
    const getItems = vi.fn((keys: string[], cb: Cb<Record<string, string>>) =>
      cb(null, { [keys[0]]: "v", [keys[1]]: "" }),
    );
    const kv = cloudKV(tg({ getItems, setItem: vi.fn() }))!;
    expect(await kv.get(["a", "b"])).toEqual({ a: "v" });
    expect(getItems.mock.calls[0][0]).toEqual(["a", "b"]);
  });

  it("does not call getItems for an empty key list", async () => {
    const getItems = vi.fn();
    const kv = cloudKV(tg({ getItems, setItem: vi.fn() }))!;
    expect(await kv.get([])).toEqual({});
    expect(getItems).not.toHaveBeenCalled();
  });

  it("rejects on a callback error and on a synchronous throw", async () => {
    const kv = cloudKV(
      tg({
        getItems: (_k: string[], cb: Cb<Record<string, string>>) =>
          cb("WEBAPP_STORAGE_FAIL"),
        setItem: (_k: string, _v: string, cb: Cb<boolean>) => cb("nope"),
      }),
    )!;
    await expect(kv.get(["a"])).rejects.toThrow("WEBAPP_STORAGE_FAIL");
    await expect(kv.set("a", "1")).rejects.toThrow("nope");

    const kv2 = cloudKV(
      tg({
        getItems: vi.fn(),
        setItem: () => {
          throw new Error("WebAppCloudStorageParamInvalid");
        },
      }),
    )!;
    await expect(kv2.set("a", "1")).rejects.toThrow(
      "WebAppCloudStorageParamInvalid",
    );
  });

  it("resolves set on success", async () => {
    const setItem = vi.fn((_k: string, _v: string, cb: Cb<boolean>) =>
      cb(null, true),
    );
    const kv = cloudKV(tg({ getItems: vi.fn(), setItem }))!;
    await expect(kv.set("k", "v")).resolves.toBeUndefined();
    expect(setItem.mock.calls[0].slice(0, 2)).toEqual(["k", "v"]);
  });

  it("rejects after ~5 s when the callback never fires", async () => {
    vi.useFakeTimers();
    const kv = cloudKV(tg({ getItems: vi.fn(), setItem: vi.fn() }))!;
    const g = expect(kv.get(["a"])).rejects.toThrow(/timeout/i);
    const s = expect(kv.set("a", "1")).rejects.toThrow(/timeout/i);
    await vi.advanceTimersByTimeAsync(4999);
    await vi.advanceTimersByTimeAsync(2);
    await g;
    await s;
  });

  it("does not time out when the callback answers in time", async () => {
    vi.useFakeTimers();
    let answer: Cb<Record<string, string>> = () => {};
    const kv = cloudKV(
      tg({
        getItems: (_k: string[], cb: Cb<Record<string, string>>) => {
          answer = cb;
        },
        setItem: vi.fn(),
      }),
    )!;
    const p = kv.get(["a"]);
    await vi.advanceTimersByTimeAsync(3000);
    answer(null, { a: "x" });
    await expect(p).resolves.toEqual({ a: "x" });
    await vi.advanceTimersByTimeAsync(10_000); // no unhandled rejection
  });
});
