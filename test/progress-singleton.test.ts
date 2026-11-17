import { describe, expect, it, vi } from "vitest";
import { createStoreHolder } from "@/lib/progress/singleton";
import type { ProgressStore } from "@/lib/progress/store";

function fake() {
  const store = { load: vi.fn(async () => ({ done: {}, quizzes: {} })) };
  const factory = vi.fn(() => store as unknown as ProgressStore);
  return { store, factory, holder: createStoreHolder(factory) };
}

describe("createStoreHolder", () => {
  it("creates nothing until asked, and the store only once", () => {
    const { store, factory, holder } = fake();
    expect(factory).not.toHaveBeenCalled();
    expect(holder.peek()).toBeUndefined();
    expect(holder.get()).toBe(store);
    holder.get();
    holder.loadOnce(["a"], ["a-q"]);
    expect(factory).toHaveBeenCalledTimes(1);
    expect(holder.peek()).toBe(store);
  });

  it("loads once per distinct set of modules and quizzes", () => {
    const { store, holder } = fake();
    holder.loadOnce(["a", "b"], ["a-q"]);
    holder.loadOnce(["a", "b"], ["a-q"]); // new arrays, same content: a remount
    holder.loadOnce(["a", "b"], ["a-q"]);
    expect(store.load).toHaveBeenCalledTimes(1);
    holder.loadOnce(["a", "b", "c"], ["a-q"]);
    expect(store.load).toHaveBeenCalledTimes(2);
    expect(store.load).toHaveBeenLastCalledWith(["a", "b", "c"], ["a-q"]);
  });

  it("does not confuse a module list with a quiz list", () => {
    const { store, holder } = fake();
    holder.loadOnce(["a"], []);
    holder.loadOnce([], ["a"]);
    expect(store.load).toHaveBeenCalledTimes(2);
  });
});
