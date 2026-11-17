// Server only (lib/content reads files): turns the curriculum into the slim shape of lib/nav.
import { groupLessons, type LessonMeta, type Module } from "@/lib/content";
import type { Lang } from "@/lib/i18n";
import type { NavLesson, NavModule } from "@/lib/nav";

// Path of a lesson page without the basePath; in the English UI a lesson without
// a translation links to its Russian page.
export function lessonLink(lang: Lang, l: LessonMeta): NavLesson {
  const en = lang === "en" && l.en;
  return {
    slug: l.slug,
    title: en ? en.title : l.title,
    href: `/${en ? "en" : "ru"}/lessons/${l.slug}/`,
  };
}

export function navModules(modules: Module[], lang: Lang): NavModule[] {
  return modules.map((m) => ({
    slug: m.slug,
    title: m.title,
    description: m.description,
    groups: groupLessons(m).map((g) => ({
      title: g.title,
      lessons: g.lessons.map((l) => lessonLink(lang, l)),
    })),
  }));
}
