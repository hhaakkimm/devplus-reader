import type { ProgressStore } from "./store";

// One store per page load, shared by every ProgressProvider mount: the [lang] layout remounts when the
// language is toggled, and a store created per mount would start empty and could miss a write still queued
// in the old one. `factory` is called lazily, so nothing is created during server render.
export function createStoreHolder(factory: () => ProgressStore) {
  let store: ProgressStore | undefined;
  let loadedKey: string | undefined;
  return {
    // The store if it exists already, without creating it.
    peek: () => store,
    get: () => (store ??= factory()),
    // Loads once per distinct set of modules and quizzes; a later mount with the same set does nothing
    // (the snapshot is kept), a different set loads again and merges into the snapshot.
    loadOnce(modules: string[], quizKeys: string[]) {
      const key = `${modules.join("|")}#${quizKeys.join("|")}`;
      if (key === loadedKey) return;
      loadedKey = key;
      void (store ??= factory()).load(modules, quizKeys);
    },
  };
}
