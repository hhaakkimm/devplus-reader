// Smoke check of the static build: exits 1 with the full list of what is missing.
import { readdirSync, statSync, existsSync } from "node:fs";
import { join, relative } from "node:path";

const OUT = "out";
const files = [];
const walk = (dir) => {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) walk(p);
    else files.push({ rel: relative(OUT, p), size: statSync(p).size });
  }
};
if (existsSync(OUT)) walk(OUT);
const has = (re) => files.some((f) => re.test(f.rel));

const required = [
  "ru/index.html",
  "en/index.html",
  "ru/quizzes/index.html",
  "en/quizzes/index.html",
  ".nojekyll",
];
const patterns = [];
for (const lang of ["ru", "en"]) {
  patterns.push([
    `${lang}/lessons/<module>/<lesson>/index.html`,
    new RegExp(`^${lang}/lessons/[^/]+/[^/]+/index\\.html$`),
  ]);
  patterns.push([
    `${lang}/quizzes/<module>/<quiz>/index.html`,
    new RegExp(`^${lang}/quizzes/[^/]+/[^/]+/index\\.html$`),
  ]);
}
patterns.push(["content/** (images)", /^content\/.+/]);

const missing = [
  ...required.filter((p) => !files.some((f) => f.rel === p)),
  ...patterns.filter(([, re]) => !has(re)).map(([name]) => name),
];
if (missing.length) {
  console.error(
    `smoke-out: missing in ${OUT}/:\n${missing.map((m) => `  - ${m}`).join("\n")}`,
  );
  process.exit(1);
}

const pages = files.filter((f) => f.rel.endsWith("index.html")).length;
const mb = files.reduce((s, f) => s + f.size, 0) / 1024 / 1024;
console.log(`smoke-out: ok, ${pages} pages, ${mb.toFixed(1)} MB`);
