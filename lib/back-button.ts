import type { Lang } from "@/lib/i18n";

// The Telegram BackButton shows on lesson and quiz screens (pathname has no basePath).
export const backVisible = (pathname: string, lang: Lang): boolean =>
  ["lessons", "quizzes"].some(
    (s) =>
      pathname === `/${lang}/${s}` || pathname.startsWith(`/${lang}/${s}/`),
  );
