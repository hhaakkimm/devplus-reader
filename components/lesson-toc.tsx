"use client";

import { useEffect, useRef, useState } from "react";
import { t, type Lang } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import type { TocItem } from "@/lib/toc";

// A thin reading-progress bar for the element with `articleId`, and (on wide screens only) a sticky
// table of contents beside it that highlights the section being read.
export function LessonToc({
  lang,
  articleId,
  items,
}: {
  lang: Lang;
  articleId: string;
  items: TocItem[];
}) {
  const bar = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState<string | null>(null);

  useEffect(() => {
    const article = document.getElementById(articleId);
    if (!article) return;
    function onScroll() {
      const { top, height } = article!.getBoundingClientRect();
      const scrollable = height - window.innerHeight;
      const done =
        scrollable > 0 ? Math.min(1, Math.max(0, -top / scrollable)) : 1;
      if (bar.current) bar.current.style.width = `${done * 100}%`;
    }
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [articleId]);

  useEffect(() => {
    // The heading that last crossed the upper part of the screen is the current section.
    const observer = new IntersectionObserver(
      (entries) => {
        for (const e of entries) if (e.isIntersecting) setActive(e.target.id);
      },
      { rootMargin: "-80px 0px -70% 0px" },
    );
    for (const { id } of items) {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    }
    return () => observer.disconnect();
  }, [items]);

  return (
    <>
      <div
        aria-hidden
        className="fixed inset-x-0 top-0 z-30 h-0.5 bg-transparent"
      >
        <div ref={bar} className="h-full w-0 bg-primary" />
      </div>
      {items.length > 1 && (
        <nav
          aria-label={t(lang, "contents")}
          className="absolute top-0 left-full hidden h-full w-60 pl-10 xl:block"
        >
          <div className="sticky top-24 max-h-[calc(100vh-8rem)] overflow-y-auto text-sm">
            <p className="mb-2 font-medium">{t(lang, "contents")}</p>
            <ul className="space-y-1.5 border-l">
              {items.map((item) => (
                <li key={item.id}>
                  <a
                    href={`#${item.id}`}
                    aria-current={active === item.id ? "location" : undefined}
                    className={cn(
                      "-ml-px block border-l-2 border-transparent py-0.5 leading-snug text-muted-foreground transition-colors hover:text-foreground",
                      item.level === 3 ? "pl-6" : "pl-3",
                      active === item.id &&
                        "border-primary font-medium text-foreground",
                    )}
                  >
                    {item.text}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </nav>
      )}
    </>
  );
}
