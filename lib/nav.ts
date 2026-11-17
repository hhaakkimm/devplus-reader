// Client-safe: no import of lib/content, which reads files with node:fs.
// The slice of the curriculum that client components need. The full Module carries summaries
// of every lesson, and every page would ship it in its payload.
export type NavLesson = { slug: string; title: string; href: string };
export type NavGroup = { title: string | null; lessons: NavLesson[] };
export type NavModule = {
  slug: string;
  title: string;
  description: string;
  groups: NavGroup[];
};

// Counts only the module's own lessons, so marks for renamed or deleted lessons are ignored.
export function moduleProgress(m: NavModule, done: ReadonlySet<string>) {
  const lessons = m.groups.flatMap((g) => g.lessons);
  return {
    done: lessons.filter((l) => done.has(l.slug)).length,
    total: lessons.length,
  };
}
