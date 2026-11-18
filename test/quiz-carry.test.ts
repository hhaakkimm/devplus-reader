import { describe, expect, it } from "vitest";
import { saveRun, takeRun, type Run } from "@/lib/quiz-carry";

const run: Run = {
  queue: [0, 1, 2, 3],
  fullPass: true,
  pos: 2,
  wrong: [1],
  done: false,
};

describe("quiz run carried over a language switch", () => {
  it("returns the run for the same quiz in the other language", () => {
    saveRun("m/q", "ru", run);
    expect(takeRun("m/q", "en")).toEqual(run);
  });

  it("starts fresh in the same language (leaving and coming back)", () => {
    saveRun("m/q", "ru", run);
    expect(takeRun("m/q", "ru")).toBeNull();
  });

  it("starts fresh for another quiz", () => {
    saveRun("m/q", "ru", run);
    expect(takeRun("m/other", "en")).toBeNull();
  });

  it("follows the latest save: ru, en, then back to ru", () => {
    saveRun("m/q", "ru", run);
    saveRun("m/q", "en", { ...run, pos: 3 });
    expect(takeRun("m/q", "ru")?.pos).toBe(3);
  });
});
