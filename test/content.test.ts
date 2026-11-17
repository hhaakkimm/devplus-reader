import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { groupLessons, loadCurriculum, loadLesson } from "@/lib/content";

const dir = path.resolve(__dirname, "fixtures/content");

describe("loadCurriculum", () => {
  it("drops excluded and empty modules", async () => {
    const slugs = (await loadCurriculum(dir)).map((m) => m.slug);
    expect(slugs).toEqual(["mod"]);
  });

  it("does not turn tasks/ and simulator/ into lessons", async () => {
    const [m] = await loadCurriculum(dir);
    expect(m.lessons.map((l) => l.lessonSlug)).toEqual(["a", "b", "c"]);
  });

  it("reads the English twin meta only where it exists", async () => {
    const [m] = await loadCurriculum(dir);
    const [a, b, c] = m.lessons;
    expect(a.en).toEqual({ title: "Lesson A", summary: "About A" });
    expect(b.en).toBeUndefined();
    expect(c.en).toEqual({ title: "Lesson C", summary: "" });
    expect(c.quiz).toBe("q1");
  });

  it("groups lessons by sections", async () => {
    const [m] = await loadCurriculum(dir);
    expect(groupLessons(m).map((g) => g.title)).toEqual([null, "Вторая часть"]);
  });
});

describe("loadLesson", () => {
  it("returns RU and EN sources", async () => {
    const l = await loadLesson("mod", "a", dir);
    expect(l?.source).toContain("Текст А");
    expect(l?.enSource).toContain("Text A");
  });

  it("has no enSource without a twin", async () => {
    const l = await loadLesson("mod", "b", dir);
    expect(l).not.toBeNull();
    expect(l?.enSource).toBeUndefined();
  });

  it("never reads excluded folders or modules", async () => {
    expect(await loadLesson("mod", "t", dir)).toBeNull();
    expect(await loadLesson("mod", "s", dir)).toBeNull();
    expect(await loadLesson("start", "hello", dir)).toBeNull();
  });

  it("returns null for unknown or path-like slugs", async () => {
    expect(await loadLesson("..", "x", dir)).toBeNull();
    expect(await loadLesson("mod", "..", dir)).toBeNull();
  });
});

describe("bad content", () => {
  const tmp: string[] = [];
  afterAll(() => Promise.all(tmp.map((d) => fs.rm(d, { recursive: true }))));

  it("names the file with broken frontmatter", async () => {
    const bad = await fs.mkdtemp(path.join(os.tmpdir(), "reader-"));
    tmp.push(bad);
    await fs.mkdir(path.join(bad, "10-m"));
    await fs.writeFile(
      path.join(bad, "10-m", "_module.json"),
      '{"title":"t","description":"d"}',
    );
    await fs.writeFile(
      path.join(bad, "10-m", "01-bad.mdx"),
      "---\ntitle: 42\nsummary: s\n---\n\nx\n",
    );
    await expect(loadCurriculum(bad)).rejects.toThrow(/01-bad\.mdx/);
  });
});
