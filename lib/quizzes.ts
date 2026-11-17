import fs from "node:fs/promises";
import path from "node:path";
import {
  CONTENT_DIR,
  MODULE_RE,
  list,
  listModules,
  slugOf,
} from "@/lib/content";
import type { Lang } from "@/lib/i18n";
import { LEVELS, type Question, type Quiz } from "@/lib/quiz-state";

export type QuizMeta = {
  slug: string; // "module/quiz"
  moduleSlug: string;
  quizSlug: string;
  title: string;
  count: number;
  en?: { title: string }; // only when quizSlug.en.json exists
};
export type QuizModule = { slug: string; title: string; quizzes: QuizMeta[] };

const QUIZ_RE = /^([a-z0-9-]+)\.json$/;

function fail(file: string, what: string): never {
  throw new Error(`${file}: ${what}`);
}

const isObj = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

function text(file: string, v: unknown, what: string): string {
  if (typeof v !== "string" || !v.trim()) {
    fail(file, `${what} must be a non-empty string`);
  }
  return v;
}

function texts(file: string, v: unknown, what: string, min: number): string[] {
  if (!Array.isArray(v) || v.length < min) {
    fail(file, `${what} needs at least ${min} strings`);
  }
  return v.map((s, i) => text(file, s, `${what}[${i}]`));
}

// A permutation of 0..n-1: every position used exactly once.
function permutation(
  file: string,
  v: unknown,
  n: number,
  what: string,
): number[] {
  const ok =
    Array.isArray(v) &&
    v.length === n &&
    [...v].sort((a, b) => a - b).every((x, i) => x === i);
  if (!ok) fail(file, `${what} must be a permutation of 0..${n - 1}`);
  return v as number[];
}

function parseQuestion(file: string, raw: unknown, i: number): Question {
  const at = `question ${i + 1}`;
  if (!isObj(raw)) fail(file, `${at} must be an object`);
  const level = raw.level;
  if (!LEVELS.includes(level as never)) {
    fail(file, `${at}: unknown level ${String(level)}`);
  }
  const common = {
    level: level as Question["level"],
    question: text(file, raw.question, `${at}.question`),
    explanation: text(file, raw.explanation, `${at}.explanation`),
  };
  switch (raw.type) {
    case "true_false":
      if (typeof raw.answer !== "boolean") {
        fail(file, `${at}.answer must be a boolean`);
      }
      return { ...common, type: "true_false", answer: raw.answer };
    case "choice": {
      const options = texts(file, raw.options, `${at}.options`, 4);
      if (options.length !== 4) {
        fail(file, `${at}.options needs exactly 4 strings`);
      }
      const answer = raw.answer;
      if (
        !Number.isInteger(answer) ||
        (answer as number) < 0 ||
        (answer as number) > 3
      ) {
        fail(file, `${at}.answer must be an index 0..3`);
      }
      return { ...common, type: "choice", options, answer: answer as number };
    }
    case "ranking": {
      const items = texts(file, raw.items, `${at}.items`, 2);
      const answer = permutation(
        file,
        raw.answer,
        items.length,
        `${at}.answer`,
      );
      return { ...common, type: "ranking", items, answer };
    }
    case "matching": {
      const left = texts(file, raw.left, `${at}.left`, 2);
      const right = texts(file, raw.right, `${at}.right`, 2);
      if (left.length !== right.length) {
        fail(file, `${at}: left and right differ in length`);
      }
      const answer = permutation(file, raw.answer, left.length, `${at}.answer`);
      return { ...common, type: "matching", left, right, answer };
    }
    default:
      return fail(file, `${at}: unknown type ${String(raw.type)}`);
  }
}

export function parseQuiz(
  file: string,
  moduleSlug: string,
  quizSlug: string,
  raw: unknown,
): Quiz {
  if (!isObj(raw)) fail(file, "quiz must be an object");
  if (!Array.isArray(raw.questions) || raw.questions.length === 0) {
    fail(file, "questions must be a non-empty list");
  }
  const source = raw.source;
  if (source !== undefined && typeof source !== "string") {
    fail(file, "source must be a string");
  }
  return {
    slug: `${moduleSlug}/${quizSlug}`,
    moduleSlug,
    quizSlug,
    title: text(file, raw.title, "title"),
    ...(source ? { source } : {}),
    questions: raw.questions.map((q, i) => parseQuestion(file, q, i)),
  };
}

async function readQuiz(
  file: string,
  moduleSlug: string,
  quizSlug: string,
): Promise<Quiz> {
  const raw = await fs.readFile(file, "utf8");
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch (e) {
    fail(file, (e as Error).message);
  }
  return parseQuiz(file, moduleSlug, quizSlug, json);
}

// The English twin quizSlug.en.json, null when absent.
async function readEnQuiz(
  moduleDir: string,
  moduleSlug: string,
  quizSlug: string,
): Promise<{ quiz: Quiz; file: string } | null> {
  const file = path.join(moduleDir, "quizzes", `${quizSlug}.en.json`);
  const quiz = await readQuiz(file, moduleSlug, quizSlug).catch((e) => {
    if (e.code === "ENOENT") return null;
    throw e;
  });
  return quiz && { quiz, file };
}

// A module without a quizzes/ folder simply has no quizzes.
async function quizFiles(moduleDir: string): Promise<string[]> {
  return list(path.join(moduleDir, "quizzes"), QUIZ_RE, false).catch((e) => {
    if (e.code === "ENOENT") return [];
    throw e;
  });
}

export async function loadQuizCatalog(
  dir = CONTENT_DIR,
): Promise<QuizModule[]> {
  const modules = await Promise.all(
    (await listModules(dir)).map(async (name) => {
      const moduleDir = path.join(dir, name);
      const files = await quizFiles(moduleDir);
      if (files.length === 0) return null;
      const slug = slugOf(name, MODULE_RE);
      const meta = JSON.parse(
        await fs.readFile(path.join(moduleDir, "_module.json"), "utf8"),
      );
      const quizzes = await Promise.all(
        files.map(async (file) => {
          const q = await readQuiz(
            path.join(moduleDir, "quizzes", file),
            slug,
            slugOf(file, QUIZ_RE),
          );
          const en = await readEnQuiz(moduleDir, slug, q.quizSlug);
          return {
            slug: q.slug,
            moduleSlug: q.moduleSlug,
            quizSlug: q.quizSlug,
            title: q.title,
            count: q.questions.length,
            ...(en ? { en: { title: en.quiz.title } } : {}),
          };
        }),
      );
      return { slug, title: String(meta.title), quizzes };
    }),
  );
  return modules.filter((m) => m !== null);
}

// `lang: "en"` swaps in the English twin (quizSlug.en.json, same questions in the same order, so the
// slug and the saved scores stay shared). `hasEn` tells the page whether to offer the switch.
export async function loadQuiz(
  moduleSlug: string,
  quizSlug: string,
  dir = CONTENT_DIR,
  lang: Lang = "ru",
): Promise<(Quiz & { hasEn: boolean }) | null> {
  // Slugs come from the URL: match them against listed names, never join them into a path.
  const moduleName = (await listModules(dir)).find(
    (n) => slugOf(n, MODULE_RE) === moduleSlug,
  );
  if (!moduleName) return null;
  const moduleDir = path.join(dir, moduleName);
  const file = (await quizFiles(moduleDir)).find(
    (n) => slugOf(n, QUIZ_RE) === quizSlug,
  );
  if (!file) return null;
  const ru = await readQuiz(
    path.join(moduleDir, "quizzes", file),
    moduleSlug,
    quizSlug,
  );
  const en = await readEnQuiz(moduleDir, moduleSlug, quizSlug);
  if (!en) return { ...ru, hasEn: false };
  if (en.quiz.questions.length !== ru.questions.length) {
    throw new Error(`${en.file}: question count differs from the Russian quiz`);
  }
  return lang === "en"
    ? { ...en.quiz, ...(ru.source ? { source: ru.source } : {}), hasEn: true }
    : { ...ru, hasEn: true };
}
