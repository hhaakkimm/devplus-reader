import { isLang, type Lang } from "@/lib/i18n";

// "en-US" -> "en" when supported. Language tags are case-insensitive (navigator gives "en-US", Telegram "en").
// shortcut: only '-' separates the region, "en_US" is not recognised; both sources send BCP 47.
const fromTag = (tag: string | null | undefined): Lang | undefined => {
  const p = tag?.split("-")[0].toLowerCase();
  return p !== undefined && isLang(p) ? p : undefined;
};

// The saved choice wins (exact "ru" | "en"), then the Telegram language, then the browser's, else Russian.
export function pickLang(i: {
  stored?: string | null;
  tg?: string | null;
  nav?: readonly string[];
}): Lang {
  if (i.stored != null && isLang(i.stored)) return i.stored;
  return fromTag(i.tg) ?? (i.nav ?? []).map(fromTag).find((l) => l) ?? "ru";
}
