import type { Lang } from "@/lib/i18n";

// The Telegram BackButton shows on lesson, quiz and guide screens (pathname has no basePath).
export const backVisible = (pathname: string, lang: Lang): boolean =>
  ["lessons", "quizzes", "guide"].some(
    (s) =>
      pathname === `/${lang}/${s}` || pathname.startsWith(`/${lang}/${s}/`),
  );
