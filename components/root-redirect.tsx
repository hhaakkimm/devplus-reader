"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { BASE_PATH } from "@/lib/links";
import { pickLang } from "@/lib/lang";
import { cloudKV, localKV } from "@/lib/progress/storage";
import { whenTelegram } from "@/lib/telegram";

// The static root page: the links work without JavaScript and while the redirect runs.
export function RootRedirect() {
  const router = useRouter();
  useEffect(() => {
    let off = false;
    void (async () => {
      const tg = await whenTelegram();
      // A choice made with the toggle (written by setLang) wins over Telegram and the browser.
      // CloudStorage is asked only when this device has none: it may hold a choice from another one.
      const stored =
        (await localKV.get(["lang"])).lang ??
        (
          await cloudKV(tg)
            ?.get(["lang"])
            .catch((): Record<string, string> => ({}))
        )?.lang;
      if (off) return;
      const lang = pickLang({
        stored,
        tg: tg?.initDataUnsafe.user?.language_code,
        nav: navigator.languages,
      });
      router.replace(`/${lang}/`);
    })();
    return () => {
      off = true;
    };
  }, [router]);

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-start justify-center gap-4 px-4">
      <h1 className="text-3xl font-semibold">devplus</h1>
      <Link href="/ru/" className="hover:underline">
        Русский
      </Link>
      <Link href="/en/" className="hover:underline">
        English
      </Link>
      <noscript>
        <a href={`${BASE_PATH}/ru/`}>Открыть программу / Open the programme</a>
      </noscript>
    </main>
  );
}
