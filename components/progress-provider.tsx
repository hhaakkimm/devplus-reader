"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
} from "react";
import { getWebApp } from "@/lib/telegram";
import { localKV, cloudKV } from "@/lib/progress/storage";
import { createStoreHolder } from "@/lib/progress/singleton";
import { createStore, type Snapshot } from "@/lib/progress/store";

// Server HTML and the first client render show no progress; it appears after the store loads.
const EMPTY: Snapshot = { done: {}, quizzes: {} };
const noop = () => () => {};

const holder = createStoreHolder(() =>
  createStore(localKV, cloudKV(getWebApp()), () =>
    Math.floor(Date.now() / 1000),
  ),
);

type Progress = {
  ready: boolean; // the store exists: marks made before are not lost
  synced: boolean;
  doneSet(moduleSlug: string): ReadonlySet<string>;
  isDone(lessonSlug: string): boolean;
  mark(lessonSlug: string, done: boolean): void;
  quizResult(quizSlug: string): string | undefined;
  saveQuiz(module: string, quiz: string, score: number, total: number): void;
  setLang(l: string): void;
};

const Ctx = createContext<Progress | null>(null);

export function ProgressProvider({
  modules,
  quizKeys,
  children,
}: {
  modules: string[]; // module slugs
  quizKeys: string[]; // "<module>-<quiz>"
  children: React.ReactNode;
}) {
  // On a remount (language toggle) the store already exists and is shown at once; on the first
  // mount, and during server render, there is none, so server HTML and hydration match.
  const [store, setStore] = useState(holder.peek);
  const key = `${modules.join("|")}#${quizKeys.join("|")}`;
  useEffect(() => {
    // The store needs the browser (Telegram.WebApp), so it cannot be created during render.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setStore(holder.get());
    holder.loadOnce(modules, quizKeys);
    // `key` stands for the contents of the arrays: the server layout builds new ones on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const snap = useSyncExternalStore(
    store ? store.subscribe : noop,
    store ? store.getSnapshot : () => EMPTY,
    () => EMPTY,
  );
  // synced() flips without a new snapshot, so it is a store of its own.
  const synced = useSyncExternalStore(
    store ? store.subscribe : noop,
    store ? store.synced : () => true,
    () => true,
  );

  const doneSets = useMemo(() => {
    // The store keys marks by the lesson slug inside a module, the UI uses "module/lesson".
    const out = new Map<string, ReadonlySet<string>>();
    for (const [m, done] of Object.entries(snap.done)) {
      out.set(
        m,
        new Set(
          Object.entries(done)
            .filter(([, t]) => t > 0)
            .map(([lesson]) => `${m}/${lesson}`),
        ),
      );
    }
    return out;
  }, [snap.done]);

  const doneSet = useCallback(
    (m: string) => doneSets.get(m) ?? new Set<string>(),
    [doneSets],
  );

  const value = useMemo<Progress>(
    () => ({
      ready: store !== null,
      synced,
      doneSet,
      isDone: (slug) => doneSet(slug.split("/")[0]).has(slug),
      mark(slug, done) {
        const [m, lesson] = slug.split("/");
        void store?.markLesson(m, lesson, done);
      },
      quizResult: (slug) => snap.quizzes[slug.replace("/", "-")],
      saveQuiz(m, quiz, score, total) {
        void store?.saveQuiz(m, quiz, score, total);
      },
      setLang(l) {
        void store?.setLang(l);
      },
    }),
    [store, synced, doneSet, snap.quizzes],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useProgress(): Progress {
  const p = useContext(Ctx);
  if (!p) throw new Error("useProgress outside ProgressProvider");
  return p;
}
