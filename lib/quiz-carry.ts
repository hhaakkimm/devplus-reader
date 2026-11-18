import type { Lang } from "@/lib/i18n";

// The RU and EN quiz pages are different routes, so switching the language remounts the quiz.
// The latest run is kept here (module scope survives client navigation) and handed over only
// when the same quiz is opened in the other language. The answer to the current question is
// not carried: the twin's option indexes are not checked against the Russian ones.
// shortcut: lives in memory, a full page reload starts the quiz over; use sessionStorage if that hurts.
export type Run = {
  queue: number[];
  fullPass: boolean;
  pos: number;
  wrong: number[];
  done: boolean;
};

let last: { slug: string; lang: Lang; run: Run } | null = null;

export const saveRun = (slug: string, lang: Lang, run: Run) => {
  last = { slug, lang, run };
};

export const takeRun = (slug: string, lang: Lang): Run | null =>
  last && last.slug === slug && last.lang !== lang ? last.run : null;
