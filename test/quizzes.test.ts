import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { loadQuiz, loadQuizCatalog } from "@/lib/quizzes";

const dir = path.resolve(__dirname, "fixtures/content");

describe("loadQuizCatalog", () => {
  it("lists quizzes with EN titles where a twin exists, skipping excluded modules", async () => {
    const catalog = await loadQuizCatalog(dir);
    expect(catalog.map((m) => m.slug)).toEqual(["mod"]);
    const [q1, q2] = catalog[0].quizzes;
    expect(q1).toMatchObject({
      quizSlug: "q1",
      count: 2,
      en: { title: "Quiz 1" },
    });
    expect(q2.quizSlug).toBe("q2");
    expect(q2.en).toBeUndefined();
  });
});

describe("loadQuiz", () => {
  it("returns the EN twin", async () => {
    const q = await loadQuiz("mod", "q1", dir, "en");
    expect(q?.hasEn).toBe(true);
    expect(q?.title).toBe("Quiz 1");
    expect(q?.questions[0].question).toBe("True?");
  });

  it("returns RU by default and keeps hasEn", async () => {
    const q = await loadQuiz("mod", "q1", dir);
    expect(q?.title).toBe("Квиз 1");
    expect(q?.hasEn).toBe(true);
  });

  it("falls back to RU without an EN twin", async () => {
    const q = await loadQuiz("mod", "q2", dir, "en");
    expect(q?.title).toBe("Квиз 2");
    expect(q?.hasEn).toBe(false);
  });

  it("returns null for unknown slugs", async () => {
    expect(await loadQuiz("..", "q1", dir)).toBeNull();
    expect(await loadQuiz("mod", "nope", dir)).toBeNull();
  });
});

describe("bad quizzes", () => {
  const tmp: string[] = [];
  afterAll(() => Promise.all(tmp.map((d) => fs.rm(d, { recursive: true }))));

  const quiz = (n: number, answer = 1) =>
    JSON.stringify({
      title: "t",
      questions: Array.from({ length: n }, () => ({
        type: "choice",
        level: "junior",
        question: "q",
        explanation: "e",
        options: ["a", "b", "c", "d"],
        answer,
      })),
    });

  async function content(files: Record<string, string>) {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "reader-"));
    tmp.push(root);
    const q = path.join(root, "10-m", "quizzes");
    await fs.mkdir(q, { recursive: true });
    await fs.writeFile(
      path.join(root, "10-m", "_module.json"),
      '{"title":"t","description":"d"}',
    );
    for (const [name, body] of Object.entries(files)) {
      await fs.writeFile(path.join(q, name), body);
    }
    return root;
  }

  it("rejects an answer outside 0..3 and names the file", async () => {
    const root = await content({ "bad.json": quiz(1, 4) });
    await expect(loadQuiz("m", "bad", root)).rejects.toThrow(/bad\.json/);
  });

  it("rejects an EN twin with a different question count", async () => {
    const root = await content({ "x.json": quiz(2), "x.en.json": quiz(1) });
    await expect(loadQuiz("m", "x", root, "en")).rejects.toThrow(/x\.en\.json/);
  });
});
