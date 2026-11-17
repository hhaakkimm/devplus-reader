"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { backVisible } from "@/lib/back-button";
import type { Lang } from "@/lib/i18n";
import { whenTelegram, type TelegramWebApp } from "@/lib/telegram";

// ready/expand and the theme listener are set up once per page load, not on every language toggle.
let started = false;

// Inside Telegram: ready, expand, theme by colorScheme, BackButton. Elsewhere it does nothing.
export function TelegramBridge({ lang }: { lang: Lang }) {
  const router = useRouter();
  const pathname = usePathname();
  const [tg, setTg] = useState<TelegramWebApp | null>(null);

  useEffect(() => {
    let off = false;
    void whenTelegram().then((w) => {
      if (off || !w) return;
      if (!started) {
        started = true;
        const theme = () =>
          document.documentElement.classList.toggle(
            "dark",
            w.colorScheme === "dark",
          );
        w.ready();
        w.expand();
        theme();
        w.onEvent("themeChanged", theme);
      }
      setTg(w);
    });
    return () => {
      off = true;
    };
  }, []);

  const visible = backVisible(pathname, lang);
  useEffect(() => {
    if (!tg) return;
    if (!visible) {
      tg.BackButton.hide();
      return;
    }
    const back = () => router.push(`/${lang}/`);
    tg.BackButton.show();
    tg.BackButton.onClick(back);
    return () => {
      tg.BackButton.offClick(back);
      tg.BackButton.hide();
    };
  }, [tg, visible, lang, router]);

  return null;
}
