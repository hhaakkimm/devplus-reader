import { describe, expect, it } from "vitest";
import { dictionary, fill, isLang, t } from "@/lib/i18n";

describe("i18n dictionary", () => {
  it("has the same keys in both languages", () => {
    expect(Object.keys(dictionary.en).sort()).toEqual(
      Object.keys(dictionary.ru).sort(),
    );
  });

  it("has no empty values", () => {
    for (const lang of ["ru", "en"] as const) {
      for (const [key, value] of Object.entries(dictionary[lang])) {
        expect(value.trim(), `${lang}.${key}`).not.toBe("");
      }
    }
  });

  it("uses the same placeholders in both languages", () => {
    const names = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]);
    for (const key of Object.keys(
      dictionary.ru,
    ) as (keyof typeof dictionary.ru)[]) {
      expect(names(dictionary.en[key]).sort(), key).toEqual(
        names(dictionary.ru[key]).sort(),
      );
    }
  });

  it("t picks the language and fill substitutes placeholders", () => {
    expect(t("ru", "contents")).toBe("Содержание");
    expect(t("en", "contents")).toBe("Contents");
    expect(fill(t("en", "bestResult"), { score: 3, total: 5 })).toBe(
      "best result 3 of 5",
    );
  });

  it("the quiz count reads as a phrase in both languages", () => {
    expect(fill(t("ru", "quizQuestions"), { n: 5 })).toBe("Вопросов: 5");
    expect(fill(t("en", "quizQuestions"), { n: 5 })).toBe("5 questions");
  });

  it("isLang accepts only known languages", () => {
    expect(isLang("ru")).toBe(true);
    expect(isLang("en")).toBe(true);
    expect(isLang("de")).toBe(false);
  });
});
