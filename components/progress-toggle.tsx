"use client";

import { useProgress } from "@/components/progress-provider";
import { Button } from "@/components/ui/button";
import { t, type Lang } from "@/lib/i18n";

export function ProgressToggle({ lang, slug }: { lang: Lang; slug: string }) {
  const { ready, isDone, mark } = useProgress();
  const done = isDone(slug);
  return (
    <Button
      disabled={!ready}
      onClick={() => mark(slug, !done)}
      variant={done ? "outline" : "default"}
    >
      {t(lang, done ? "unmarkDone" : "markDone")}
    </Button>
  );
}
