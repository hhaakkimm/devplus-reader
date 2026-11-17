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
  // load and every write run one after another, so none of them reads a stale snapshot
  // or overwrites a newer write, and the cloud always ends with the latest state.
  let queue: Promise<unknown> = Promise.resolve();
  const enqueue = <T>(run: () => Promise<T>): Promise<T> => {
    const p = queue.then(run);
    queue = p.catch(() => undefined);
    return p;
  };

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

  const readLocal = (keys: string[]) =>
    local.get(keys).catch(() => ({}) as Record<string, string>);
  const writeLocal = async (entries: Record<string, string>) => {
    for (const [k, v] of Object.entries(entries)) {
      try {
        await local.set(k, v);
      } catch {
        // localKV swallows its own errors; a foreign KV must not break the UI either
      }
    }
  };

  // Write path: `build` merges what a KV holds into the snapshot and returns the entries to
  // store. Two steps:
  // 1. at once, outside the queue: merge localStorage's current content and write it back, so the
  //    mark survives closing the app before the (slow) CloudStorage round trip finishes, and a
  //    stale tab never overwrites another tab's marks or lowers a quiz result. `build` is
  //    idempotent, so running it again in step 2 is safe. Does not touch synced.
  // 2. queued: read the cloud, merge, write local again (re-reading it, another tab may have written
  //    meanwhile) and then the cloud. A failed cloud read means the cloud is never written (it would
  //    be overwritten blind) and synced goes false; a cloud write failure also flips synced. A fully
  //    successful cloud round trip sets it back to true. Nothing is thrown.
  // shortcut: a tap during load's write-back loop can be overwritten locally until its queued persist runs, add a local lock if that matters.
  function persist(
    keys: string[],
    build: (raw: Record<string, string>) => Record<string, string>,
  ): Promise<void> {
    void readLocal(keys)
      .then((l) => writeLocal(build(l)))
      .catch(() => undefined);
    return enqueue(async () => {
      let raw: Record<string, string> = {};
      let ok = true;
      if (cloud && keys.length > 0) {
        try {
          raw = await cloud.get(keys);
        } catch {
          ok = false;
        }
      }
      build(await readLocal(keys)); // folds other tabs' writes into the snapshot
      const entries = build(raw);
      await writeLocal(entries);
      if (!cloud) return;
      if (ok) {
        for (const [k, v] of Object.entries(entries)) {
          try {
            await cloud.set(k, v);
          } catch {
            ok = false;
          }
        }
      }
      setSynced(ok);
    });
  }

  return {
    load: (modules, quizKeys) =>
      enqueue(async () => {
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

        // Everything below merges INTO the current snapshot, read after the awaits above,
        // so a mark made while the reads were pending is kept.
        const writes: { to: "local" | "cloud"; key: string; value: string }[] =
          [];
        const done: Record<string, Done> = {};
        for (const m of modules) {
          const ld = joinDone(m, lv);
          const cd = joinDone(m, cv);
          const merged = mergeDone(mergeDone(ld, cd), snap.done[m] ?? {});
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
          const merged = mergeQuiz(
            mergeQuiz(lv[key], cv[key]),
            snap.quizzes[q],
          );
          if (merged === undefined) continue;
          quizzes[q] = merged;
          // mergeQuiz(held, merged) !== held: held is missing, invalid or lower
          if (mergeQuiz(lv[key], merged) !== lv[key])
            writes.push({ to: "local", key, value: merged });
          if (cloudOk && mergeQuiz(cv[key], merged) !== cv[key])
            writes.push({ to: "cloud", key, value: merged });
        }

        // shortcut: lang has no timestamp, local wins and a differing cloud value is left alone, add a timestamp if lang must sync back
        const lang = snap.lang || lv.lang || cv.lang || undefined;
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
        // Synced rule: no write is in flight here (the queue), and after a successful cloud
        // read plus write-back the cloud holds the merge of everything in the snapshot for the
        // loaded modules and quizzes, so the load's own outcome decides.
        if (cloud) setSynced(ok);
        // The write-back above awaited, so a write may have changed `snap` meanwhile: merge
        // into the CURRENT snapshot, synchronously with no await before setSnap. The write's
        // own queued persist runs after this load and stores its value.
        const finalDone = { ...snap.done };
        for (const m of Object.keys(done))
          finalDone[m] = mergeDone(done[m], snap.done[m] ?? {});
        const finalQuizzes = { ...snap.quizzes };
        for (const [q, v] of Object.entries(quizzes))
          finalQuizzes[q] = mergeQuiz(v, snap.quizzes[q]) ?? v;
        const finalLang = snap.lang || lang;
        setSnap({
          ...snap,
          done: finalDone,
          quizzes: finalQuizzes,
          ...(finalLang ? { lang: finalLang } : {}),
        });
        return snap;
      }),

    async markLesson(module, slug, isDoneNow) {
      // optimistic: the UI sees the mark at once, the queue then merges with the cloud
      setSnap({
        ...snap,
        done: {
          ...snap.done,
          [module]: mark(snap.done[module] ?? {}, slug, isDoneNow, now()),
        },
      });
      await persist(
        Array.from({ length: READ_CHUNKS }, (_, i) => doneKey(module, i + 1)),
        (raw) => {
          const cur = snap.done[module] ?? {};
          const merged = mergeDone(cur, joinDone(module, raw));
          if (!same(cur, merged))
            setSnap({ ...snap, done: { ...snap.done, [module]: merged } });
          return splitDone(module, merged);
        },
      );
    },

    async saveQuiz(module, quiz, score, total) {
      const q = `${module}-${quiz}`;
      const key = `quiz-${q}`;
      const best = mergeQuiz(snap.quizzes[q], `${score}/${total}`);
      if (best === undefined || best === snap.quizzes[q]) return;
      setSnap({ ...snap, quizzes: { ...snap.quizzes, [q]: best } });
      await persist([key], (raw) => {
        const merged = mergeQuiz(snap.quizzes[q], raw[key]) ?? best;
        if (merged !== snap.quizzes[q])
          setSnap({ ...snap, quizzes: { ...snap.quizzes, [q]: merged } });
        return { [key]: merged };
      });
    },

    async setLang(l) {
      setSnap({ ...snap, lang: l });
      await persist([], () => ({ lang: l }));
    },

    subscribe(fn) {
      subs.add(fn);
      return () => void subs.delete(fn);
    },
    getSnapshot: () => snap,
    synced: () => isSynced,
  };
}
