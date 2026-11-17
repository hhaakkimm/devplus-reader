"use client";

import Link from "next/link";
import { useProgress } from "@/components/progress-provider";
import { t, type Lang } from "@/lib/i18n";
import { moduleProgress, type NavModule } from "@/lib/nav";

// The whole programme as a tree: the current module is open, the rest are folded.
// `current` is "module/lesson". Plain <details>: no client JS needed to fold and unfold.
export function CurriculumNav({
  lang,
  modules,
  current,
}: {
  lang: Lang;
  modules: NavModule[];
  current: string;
}) {
  const { doneSet } = useProgress();
  const currentModule = current.split("/")[0];
  return (
    <nav aria-label={t(lang, "programme")} className="text-sm">
      {modules.map((m) => {
        const done = doneSet(m.slug);
        const progress = moduleProgress(m, done);
        return (
          <details
            key={m.slug}
            open={m.slug === currentModule}
            className="border-b py-1 last:border-b-0"
          >
            <summary className="flex cursor-pointer list-none items-center justify-between gap-2 rounded-md px-2 py-1.5 font-medium hover:bg-muted [&::-webkit-details-marker]:hidden">
              <span>{m.title}</span>
              <span className="shrink-0 text-xs font-normal text-muted-foreground">
                {progress.done}/{progress.total}
              </span>
            </summary>
            <div className="pb-1">
              {m.groups.map((g) => (
                <div key={g.title ?? "_"} className="mt-3 first:mt-1">
                  {g.title && (
                    <p className="mb-1 border-l-2 border-primary px-2 py-0.5 text-xs font-semibold tracking-wide text-foreground uppercase">
                      {g.title}
                    </p>
                  )}
                  <ul className="ml-1 border-l pl-1">
                    {g.lessons.map((l) => {
                      const active = l.slug === current;
                      return (
                        <li key={l.slug}>
                          <Link
                            href={l.href}
                            prefetch={false} // hundreds of links: prefetching them all would download every page
                            aria-current={active ? "page" : undefined}
                            className={`block rounded-md px-2 py-1 ${
                              active
                                ? "bg-secondary font-medium text-secondary-foreground"
                                : done.has(l.slug)
                                  ? "text-emerald-700 hover:bg-muted dark:text-emerald-400"
                                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
                            }`}
                          >
                            {done.has(l.slug) ? "✓ " : ""}
                            {l.title}
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
            </div>
          </details>
        );
      })}
    </nav>
  );
}
