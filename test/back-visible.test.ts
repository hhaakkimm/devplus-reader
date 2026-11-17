import { describe, expect, it } from "vitest";
import { backVisible } from "@/lib/back-button";

describe("backVisible", () => {
  it("shows on lessons and quizzes of the current language", () => {
    expect(backVisible("/ru/lessons/sd-prep/introduction/", "ru")).toBe(true);
    expect(backVisible("/en/quizzes/", "en")).toBe(true);
    expect(backVisible("/ru/quizzes/sd-prep/core-concepts/", "ru")).toBe(true);
  });

  it("hides on the programme and the root", () => {
    expect(backVisible("/ru/", "ru")).toBe(false);
    expect(backVisible("/en", "en")).toBe(false);
    expect(backVisible("/", "ru")).toBe(false);
  });

  it("does not match another language or a look-alike prefix", () => {
    expect(backVisible("/en/lessons/a/b/", "ru")).toBe(false);
    expect(backVisible("/ru/lessonsx/", "ru")).toBe(false);
    expect(backVisible("/ru/quizzes", "ru")).toBe(true);
  });
});
