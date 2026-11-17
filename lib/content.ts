import fs from "node:fs/promises";
import path from "node:path";
import matter from "gray-matter";

export type LessonMeta = {
  slug: string; // "module/lesson"
  moduleSlug: string;
  lessonSlug: string;
  title: string;
  summary: string;
  order: number; // the numeric prefix of the file: "05-x.mdx" is 5
  quiz?: string; // slug of a quiz from the same module's quizzes/ folder
  en?: { title: string; summary: string }; // only when the sibling NN-slug.en.mdx exists
};
// shortcut: titles of modules and sections are Russian-only, add optional title_en to _module.json in devplus when needed
// A subsection of a module: starts at the lesson whose `order` is `from`, runs to the next section.
export type Section = { title: string; from: number };
export type Module = {
  slug: string;
  title: string;
  description: string;
  sections: Section[]; // [] for a flat module
  lessons: LessonMeta[];
};
// `title` is null for lessons that come before the first section (or in a flat module).
export type LessonGroup = { title: string | null; lessons: LessonMeta[] };
// `enSource`: body of the sibling NN-slug.en.mdx, absent without an English version.
export type Lesson = LessonMeta & { source: string; enSource?: string };

// Not shown in the reader. `folders` are module subfolders; lessons are read only from the module
// root, so they are skipped by construction, the constant documents it.
export const EXCLUDED = {
  modules: ["00-start"],
  folders: ["tasks", "simulator"],
} as const;

// turbopackIgnore: keeps the file tracer from pulling the whole project in.
export const CONTENT_DIR =
  process.env.CONTENT_DIR ??
  path.resolve(/*turbopackIgnore: true*/ process.cwd(), "../devplus/content");

export const MODULE_RE = /^\d{2}-([a-z0-9-]+)$/;
const LESSON_RE = /^\d{2}-([a-z0-9-]+)\.mdx$/;

// Names matching `re`, ordered by their numeric prefix. Everything else is ignored.
export async function list(dir: string, re: RegExp, dirs: boolean) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  return entries
    .filter((e) => e.isDirectory() === dirs && re.test(e.name))
    .map((e) => e.name)
    .sort();
}

// Module folders the reader shows.
export async function listModules(dir: string) {
  return (await list(dir, MODULE_RE, true)).filter(
    (n) => !(EXCLUDED.modules as readonly string[]).includes(n),
  );
}

export const slugOf = (name: string, re: RegExp) => name.match(re)![1];

// Parser errors carry only a position, so name the file ourselves.
function parse<T>(file: string, fn: () => T): T {
  try {
    return fn();
  } catch (e) {
    throw new Error(`${file}: ${(e as Error).message}`);
  }
}

// The English twin of an .mdx file: title is required, summary may be missing.
async function readEn(file: string): Promise<{
  meta: { title: string; summary: string };
  source: string;
} | null> {
  const enFile = file.replace(/\.mdx$/, ".en.mdx");
  const raw = await fs.readFile(enFile, "utf8").catch((e) => {
    if (e.code === "ENOENT") return null; // not every lesson has an English version
    throw e;
  });
  if (raw === null) return null;
  const { data, content } = parse(enFile, () => matter(raw));
  if (typeof data.title !== "string") {
    throw new Error(`${enFile}: frontmatter needs title`);
  }
  const summary = typeof data.summary === "string" ? data.summary : "";
  return { meta: { title: data.title, summary }, source: content };
}

async function readLesson(
  file: string,
  moduleSlug: string,
  lessonSlug: string,
): Promise<{ meta: LessonMeta; source: string; enSource?: string }> {
  const raw = await fs.readFile(file, "utf8");
  const { data, content } = parse(file, () => matter(raw));
  const { title, summary, quiz } = data;
  if (typeof title !== "string" || typeof summary !== "string") {
    throw new Error(`${file}: frontmatter needs title and summary`);
  }
  const slug = `${moduleSlug}/${lessonSlug}`;
  const en = await readEn(file);
  return {
    meta: {
      slug,
      moduleSlug,
      lessonSlug,
      title,
      summary,
      order: Number(path.basename(file).slice(0, 2)),
      ...(typeof quiz === "string" ? { quiz } : {}),
      ...(en ? { en: en.meta } : {}),
    },
    source: content,
    ...(en ? { enSource: en.source } : {}),
  };
}

function parseSections(moduleDir: string, raw: unknown): Section[] {
  if (raw === undefined) return [];
  const fail = (rest: string) =>
    new Error(`${moduleDir}: _module.json sections ${rest}`);
  if (!Array.isArray(raw)) throw fail('need a title and a number "from"');
  const sections = raw.map((s) => {
    if (typeof s?.title !== "string" || !Number.isInteger(s?.from)) {
      throw fail('need a title and a number "from"');
    }
    return { title: s.title, from: s.from as number };
  });
  sections.forEach((s, i) => {
    if (i > 0 && s.from <= sections[i - 1].from) {
      throw fail('must go in ascending "from"');
    }
  });
  return sections;
}

// Lessons sit in the first section whose `from` they reach; sections without lessons are dropped.
export function groupLessons(
  m: Pick<Module, "lessons" | "sections">,
): LessonGroup[] {
  const groups: LessonGroup[] = [{ title: null, lessons: [] }];
  for (const s of m.sections) groups.push({ title: s.title, lessons: [] });
  for (const l of m.lessons) {
    const at = m.sections.filter((s) => s.from <= l.order).length;
    groups[at].lessons.push(l);
  }
  return groups.filter((g) => g.lessons.length > 0);
}

export async function loadCurriculum(dir = CONTENT_DIR): Promise<Module[]> {
  const modules = await Promise.all(
    (await listModules(dir)).map(async (name) => {
      const moduleDir = path.join(dir, name);
      const slug = slugOf(name, MODULE_RE);
      const moduleFile = path.join(moduleDir, "_module.json");
      let raw: string;
      try {
        raw = await fs.readFile(moduleFile, "utf8");
      } catch (e) {
        if ((e as NodeJS.ErrnoException).code === "ENOENT") {
          throw new Error(`${moduleDir}: missing _module.json`);
        }
        throw e;
      }
      const {
        title,
        description,
        sections: rawSections,
      } = parse(moduleFile, () => JSON.parse(raw) ?? {});
      if (typeof title !== "string" || typeof description !== "string") {
        throw new Error(
          `${moduleDir}: _module.json needs title and description`,
        );
      }
      const sections = parseSections(moduleDir, rawSections);
      const files = await list(moduleDir, LESSON_RE, false);
      const lessons = await Promise.all(
        // Only meta: curriculum is for listings, loadLesson returns the body.
        files.map(async (file) => {
          const lesson = await readLesson(
            path.join(moduleDir, file),
            slug,
            slugOf(file, LESSON_RE),
          );
          return lesson.meta;
        }),
      );
      return { slug, title, description, sections, lessons };
    }),
  );
  return modules.filter((m) => m.lessons.length > 0);
}

export async function loadLesson(
  moduleSlug: string,
  lessonSlug: string,
  dir = CONTENT_DIR,
): Promise<Lesson | null> {
  // Slugs come from the URL: match them against listed names, never join them into a path.
  const moduleName = (await listModules(dir)).find(
    (n) => slugOf(n, MODULE_RE) === moduleSlug,
  );
  if (!moduleName) return null;
  const moduleDir = path.join(dir, moduleName);
  const file = (await list(moduleDir, LESSON_RE, false)).find(
    (n) => slugOf(n, LESSON_RE) === lessonSlug,
  );
  if (!file) return null;
  const { meta, source, enSource } = await readLesson(
    path.join(moduleDir, file),
    moduleSlug,
    lessonSlug,
  );
  return { ...meta, source, ...(enSource !== undefined ? { enSource } : {}) };
}
