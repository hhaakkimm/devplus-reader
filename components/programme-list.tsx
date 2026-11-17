"use client";

import Link from "next/link";
import { useProgress } from "@/components/progress-provider";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { moduleProgress, type NavModule } from "@/lib/nav";

// The programme screen: modules as folds with their sections and lessons.
export function ProgrammeList({ modules }: { modules: NavModule[] }) {
  const { doneSet } = useProgress();
  const size = (m: NavModule) =>
    m.groups.reduce((n, g) => n + g.lessons.length, 0);
  return (
    // Long modules (imported articles) start collapsed so the page stays scannable.
    <Accordion
      multiple
      defaultValue={modules.filter((m) => size(m) <= 10).map((m) => m.slug)}
      className="mt-6 gap-3"
    >
      {modules.map((m) => {
        const done = doneSet(m.slug);
        const progress = moduleProgress(m, done);
        const complete = progress.done === progress.total;
        return (
          <AccordionItem
            key={m.slug}
            value={m.slug}
            role="region"
            aria-label={m.title}
            className="rounded-xl border bg-card px-4 shadow-xs"
          >
            <AccordionTrigger className="items-center py-4 hover:no-underline">
              <span className="flex-1">
                <span className="block text-lg font-semibold">{m.title}</span>
                <span className="block text-sm font-normal text-muted-foreground">
                  {m.description}
                </span>
              </span>
              <Badge
                variant="secondary"
                className={
                  complete
                    ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400"
                    : undefined
                }
              >
                {complete ? "✓ " : ""}
                {progress.done}/{progress.total}
              </Badge>
            </AccordionTrigger>
            <AccordionContent className="[&_a]:no-underline">
              {/* Sections come from `sections` in _module.json; a flat module is one untitled group. */}
              <div className="space-y-3 pb-2">
                {m.groups.map((g) => (
                  <section
                    key={g.title ?? "_"}
                    className="overflow-hidden rounded-lg border bg-muted/30"
                  >
                    {g.title && (
                      <h3 className="flex items-center justify-between gap-3 border-b border-l-4 border-l-primary bg-muted/60 px-3 py-2 text-sm font-semibold">
                        <span>{g.title}</span>
                        <span className="text-xs font-normal text-muted-foreground">
                          {g.lessons.filter((l) => done.has(l.slug)).length}/
                          {g.lessons.length}
                        </span>
                      </h3>
                    )}
                    <ul className="p-1">
                      {g.lessons.map((l) => (
                        <li key={l.slug}>
                          <Link
                            href={l.href}
                            prefetch={false} // hundreds of links: prefetching them all would download every page
                            className={`block rounded-md px-2 py-1.5 text-sm hover:bg-muted ${
                              done.has(l.slug)
                                ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                                : ""
                            }`}
                          >
                            {done.has(l.slug) ? "✓ " : ""}
                            {l.title}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </section>
                ))}
              </div>
            </AccordionContent>
          </AccordionItem>
        );
      })}
    </Accordion>
  );
}
