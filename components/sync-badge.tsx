"use client";

import { useProgress } from "@/components/progress-provider";
import { t, type Lang } from "@/lib/i18n";

// Quiet note: the progress lives on this device only until CloudStorage works again.
export function SyncBadge({ lang }: { lang: Lang }) {
  const { synced } = useProgress();
  if (synced) return null;
  return (
    <span className="ml-auto text-xs text-muted-foreground">
      {t(lang, "notSynced")}
    </span>
  );
}
