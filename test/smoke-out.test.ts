import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

let dir: string | undefined;
afterEach(() => {
  if (dir) rmSync(dir, { recursive: true, force: true });
  dir = undefined;
});

const put = (rel: string) => {
  const p = join(dir!, rel);
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, "x");
};

// A fake out/ with the required files, `ru`/`en` lesson pages and `extra` filler pages.
function build({ ru, en, extra }: { ru: number; en: number; extra: number }) {
  dir = mkdtempSync(join(tmpdir(), "smoke-out-"));
  for (const f of [
    "ru/index.html",
    "en/index.html",
    "ru/quizzes/index.html",
    "en/quizzes/index.html",
    "ru/quizzes/m/q/index.html",
    "en/quizzes/m/q/index.html",
    ".nojekyll",
    "content/img.png",
  ])
    put(f);
  for (let i = 0; i < ru; i++) put(`ru/lessons/m/l${i}/index.html`);
  for (let i = 0; i < en; i++) put(`en/lessons/m/l${i}/index.html`);
  for (let i = 0; i < extra; i++) put(`ru/filler/f${i}/index.html`);
  return spawnSync("node", ["scripts/smoke-out.mjs"], {
    env: { ...process.env, SMOKE_OUT: dir },
    encoding: "utf8",
  });
}

describe("smoke-out floors", () => {
  it("passes a build above every floor", () => {
    const r = build({ ru: 120, en: 120, extra: 100 });
    expect(r.status).toBe(0);
    expect(r.stdout).toContain("smoke-out: ok");
  });

  it("fails when the RU lesson count is under its floor", () => {
    const r = build({ ru: 99, en: 120, extra: 100 });
    expect(r.status).toBe(1);
    expect(r.stderr).toMatch(/ru lesson pages: 99 < 100/);
    expect(r.stderr).not.toMatch(/en lesson pages/);
  });

  it("fails when the EN lesson count is under its floor", () => {
    const r = build({ ru: 120, en: 99, extra: 100 });
    expect(r.status).toBe(1);
    expect(r.stderr).toMatch(/en lesson pages: 99 < 100/);
  });

  it("fails when the total page count is under its floor", () => {
    const r = build({ ru: 120, en: 120, extra: 0 });
    expect(r.status).toBe(1);
    expect(r.stderr).toMatch(/pages: \d+ < 300/);
  });

  it("reports every failure at once, floors together with missing files", () => {
    const r = build({ ru: 5, en: 5, extra: 0 });
    expect(r.status).toBe(1);
    expect(r.stderr).toMatch(/ru lesson pages: 5 < 100/);
    expect(r.stderr).toMatch(/en lesson pages: 5 < 100/);
    expect(r.stderr).toMatch(/pages: \d+ < 300/);
  });

  it("still lists missing required files", () => {
    const r = build({ ru: 120, en: 120, extra: 100 });
    rmSync(join(dir!, "en/index.html"));
    const again = spawnSync("node", ["scripts/smoke-out.mjs"], {
      env: { ...process.env, SMOKE_OUT: dir },
      encoding: "utf8",
    });
    expect(r.status).toBe(0);
    expect(again.status).toBe(1);
    expect(again.stderr).toContain("en/index.html");
  });
});
