import path from "node:path";
import { describe, expect, it } from "vitest";
import { loadCurriculum } from "@/lib/content";
import { moduleProgress } from "@/lib/nav";
import { navModules } from "@/lib/nav-modules";

const dir = path.resolve(__dirname, "fixtures/content");

describe("navModules", () => {
  it("uses English titles and pages only where a translation exists", async () => {
    const [m] = navModules(await loadCurriculum(dir), "en");
    const lessons = m.groups.flatMap((g) => g.lessons);
    expect(lessons.map((l) => l.href)).toEqual([
      "/en/lessons/mod/a/",
      "/ru/lessons/mod/b/",
      "/en/lessons/mod/c/",
    ]);
    expect(lessons[0].title).toBe("Lesson A");
    expect(lessons[1].title).not.toBe("Lesson A");
  });

  it("links the Russian pages in the Russian UI", async () => {
    const [m] = navModules(await loadCurriculum(dir), "ru");
    const hrefs = m.groups.flatMap((g) => g.lessons.map((l) => l.href));
    expect(hrefs.every((h) => h.startsWith("/ru/lessons/mod/"))).toBe(true);
  });

  it("counts only lessons of the module", async () => {
    const [m] = navModules(await loadCurriculum(dir), "ru");
    const done = new Set(["mod/a", "mod/gone", "other/a"]);
    expect(moduleProgress(m, done)).toEqual({ done: 1, total: 3 });
  });
});
