"use client";

import Link from "next/link";
import { useProgress } from "@/components/progress-provider";
import { LANGS, t, type Lang } from "@/lib/i18n";
import { cn } from "@/lib/utils";

// `path` is the page path without the language: "/" or "/lessons/m/l/". The caller renders
// the toggle only where the other version exists. Clicking remembers the choice.
export function LangToggle({ lang, path }: { lang: Lang; path: string }) {
  const { setLang } = useProgress();
  return (
    <nav
      aria-label={t(lang, "materialLanguage")}
      className="inline-flex shrink-0 overflow-hidden rounded-md border text-xs font-medium"
    >
      {LANGS.map((l) => (
        <Link
          key={l}
          href={`/${l}${path}`}
          scroll={false}
          hrefLang={l}
          onClick={() => setLang(l)}
          aria-current={l === lang ? "true" : undefined}
          className={cn(
            "px-2.5 py-1 transition-colors",
            l === lang
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:bg-muted",
          )}
        >
          {l.toUpperCase()}
        </Link>
      ))}
    </nav>
  );
}
