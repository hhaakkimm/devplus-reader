"use client";

import { useProgress } from "@/components/progress-provider";
import { Badge } from "@/components/ui/badge";
import { fill, t, type Lang } from "@/lib/i18n";

// The best result of a quiz ("module/quiz"), shown as stored: "3/5" is "3 of 5" even if the quiz has changed since.
export function BestScore({ lang, quiz }: { lang: Lang; quiz: string }) {
  const { quizResult } = useProgress();
  const m = /^(\d+)\/(\d+)$/.exec(quizResult(quiz) ?? "");
  if (!m) return null;
  return (
    <Badge variant="secondary">
      {fill(t(lang, "bestResult"), { score: m[1], total: m[2] })}
    </Badge>
  );
}
