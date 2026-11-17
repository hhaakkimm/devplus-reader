// Smoke check of the static build: exits 1 with the full list of what is missing.
import { readdirSync, statSync, existsSync } from "node:fs";
import { join, relative } from "node:path";

const OUT = process.env.SMOKE_OUT ?? "out"; // SMOKE_OUT: the test points it at a fake build
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
  "ru/guide/index.html",
  "en/guide/index.html",
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

// Floors for unattended daily runs: a content sync that silently dropped most of the programme
// must fail the deploy. The build had 385 pages and 139 lessons per language on 2026-11-17.
// shortcut: fixed floors, lower them if the programme is cut down on purpose.
const count = (re) => files.filter((f) => re.test(f.rel)).length;
const pages = count(/index\.html$/);
const floors = [
  ["pages", pages, 300],
  ...["ru", "en"].map((l) => [
    `${l} lesson pages`,
    count(new RegExp(`^${l}/lessons/[^/]+/[^/]+/index\\.html$`)),
    100,
  ]),
];
const low = floors.filter(([, n, min]) => n < min);

if (missing.length || low.length) {
  console.error(
    `smoke-out: problems in ${OUT}/:\n${[
      ...missing.map((m) => `missing: ${m}`),
      ...low.map(([name, n, min]) => `${name}: ${n} < ${min}`),
    ]
      .map((m) => `  - ${m}`)
      .join("\n")}`,
  );
  process.exit(1);
}

const mb = files.reduce((s, f) => s + f.size, 0) / 1024 / 1024;
console.log(`smoke-out: ok, ${pages} pages, ${mb.toFixed(1)} MB`);
