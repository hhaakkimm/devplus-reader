import type { KV } from "./storage";
import {
  doneKey,
  joinDone,
  mark,
  mergeDone,
  mergeQuiz,
  splitDone,
  type Done,
} from "./merge";

// quizzes are keyed "<module>-<quiz>" (storage key: "quiz-<module>-<quiz>").
export type Snapshot = {
  done: Record<string, Done>;
  quizzes: Record<string, string>;
  lang?: string;
};

export type ProgressStore = {
  load(modules: string[], quizKeys: string[]): Promise<Snapshot>;
  markLesson(module: string, slug: string, done: boolean): Promise<void>;
  saveQuiz(
    module: string,
    quiz: string,
    score: number,
    total: number,
  ): Promise<void>;
  setLang(l: string): Promise<void>;
  subscribe(fn: () => void): () => void;
  getSnapshot(): Snapshot;
  synced(): boolean;
};

// load reads at most this many `done` chunks per module.
// shortcut: chunks beyond 3 are written but never read back (~270 lessons per module), raise if a module gets bigger.
const READ_CHUNKS = 3;

const same = (a: Done, b: Done) =>
  Object.keys(a).length === Object.keys(b).length &&
  Object.entries(a).every(([k, t]) => b[k] === t);

export function createStore(
  local: KV,
  cloud: KV | null,
  now: () => number,
): ProgressStore {
  let snap: Snapshot = { done: {}, quizzes: {} };
  let isSynced = true;
  const subs = new Set<() => void>();
  // Writes run one after another, so the cloud always ends with the latest state.
  let queue: Promise<unknown> = Promise.resolve();

  const notify = () => subs.forEach((fn) => fn());
  const setSnap = (next: Snapshot) => {
    snap = next;
    notify();
  };
  const setSynced = (v: boolean) => {
    if (v === isSynced) return;
    isSynced = v;
    notify();
  };

  // local first, then cloud; nothing is thrown, a cloud failure only flips synced.
  async function persist(entries: () => Record<string, string>): Promise<void> {
    const run = async () => {
      const e = entries();
      for (const [k, v] of Object.entries(e)) {
        try {
          await local.set(k, v);
        } catch {
          // localKV swallows its own errors; a foreign KV must not break the UI either
        }
      }
      if (!cloud) return;
      let ok = true;
      for (const [k, v] of Object.entries(e)) {
        try {
          await cloud.set(k, v);
        } catch {
          ok = false;
        }
      }
      setSynced(ok);
    };
    const p = queue.then(run);
    queue = p.catch(() => undefined);
    await p;
  }

  return {
    async load(modules, quizKeys) {
      const keys = [
        ...modules.flatMap((m) =>
          Array.from({ length: READ_CHUNKS }, (_, i) => doneKey(m, i + 1)),
        ),
        ...quizKeys.map((q) => `quiz-${q}`),
        "lang",
      ];
      const lv = await local
        .get(keys)
        .catch(() => ({}) as Record<string, string>);
      let cv: Record<string, string> = {};
      let cloudOk = cloud !== null;
      if (cloud) {
        try {
          cv = await cloud.get(keys);
        } catch {
          cloudOk = false;
        }
      }
      let ok = cloud === null || cloudOk;

      const writes: { to: "local" | "cloud"; key: string; value: string }[] =
        [];
      const done: Record<string, Done> = {};
      for (const m of modules) {
        const ld = joinDone(m, lv);
        const cd = joinDone(m, cv);
        const merged = mergeDone(ld, cd);
        done[m] = merged;
        const parts = splitDone(m, merged);
        const queueFor = (
          to: "local" | "cloud",
          held: Done,
          raw: typeof lv,
        ) => {
          if (same(held, merged)) return;
          for (const [key, value] of Object.entries(parts)) {
            if (raw[key] !== value) writes.push({ to, key, value });
          }
        };
        queueFor("local", ld, lv);
        if (cloudOk) queueFor("cloud", cd, cv);
      }

      const quizzes: Record<string, string> = {};
      for (const q of quizKeys) {
        const key = `quiz-${q}`;
        const merged = mergeQuiz(lv[key], cv[key]);
        if (merged === undefined) continue;
        quizzes[q] = merged;
        // mergeQuiz(held, merged) !== held: held is missing, invalid or lower
        if (mergeQuiz(lv[key], merged) !== lv[key])
          writes.push({ to: "local", key, value: merged });
        if (cloudOk && mergeQuiz(cv[key], merged) !== cv[key])
          writes.push({ to: "cloud", key, value: merged });
      }

      // shortcut: lang has no timestamp, local wins and a differing cloud value is left alone, add a timestamp if lang must sync back
      const lang = lv.lang || cv.lang || undefined;
      if (lang) {
        if (!lv.lang) writes.push({ to: "local", key: "lang", value: lang });
        if (cloudOk && !cv.lang)
          writes.push({ to: "cloud", key: "lang", value: lang });
      }

      for (const w of writes) {
        if (w.to === "local") {
          await local.set(w.key, w.value).catch(() => undefined);
        } else if (cloud) {
          try {
            await cloud.set(w.key, w.value);
          } catch {
            ok = false;
          }
        }
      }
      isSynced = ok;
      setSnap({ done, quizzes, ...(lang ? { lang } : {}) });
      return snap;
    },

    async markLesson(module, slug, isDoneNow) {
      const cur = snap.done[module] ?? {};
      setSnap({
        ...snap,
        done: { ...snap.done, [module]: mark(cur, slug, isDoneNow, now()) },
      });
      await persist(() => splitDone(module, snap.done[module]));
    },

    async saveQuiz(module, quiz, score, total) {
      const q = `${module}-${quiz}`;
      const value = `${score}/${total}`;
      const best = mergeQuiz(snap.quizzes[q], value);
      if (best === undefined || best === snap.quizzes[q]) return;
      setSnap({ ...snap, quizzes: { ...snap.quizzes, [q]: best } });
      await persist(() => ({ [`quiz-${q}`]: snap.quizzes[q] }));
    },

    async setLang(l) {
      setSnap({ ...snap, lang: l });
      await persist(() => ({ lang: l }));
    },

    subscribe(fn) {
      subs.add(fn);
      return () => void subs.delete(fn);
    },
    getSnapshot: () => snap,
    synced: () => isSynced,
  };
}
