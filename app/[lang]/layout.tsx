import Link from "next/link";
import { notFound } from "next/navigation";
import { ProgressProvider } from "@/components/progress-provider";
import { SyncBadge } from "@/components/sync-badge";
import { TelegramBridge } from "@/components/telegram-bridge";
import { getCurriculum, getQuizCatalog } from "@/lib/data";
import { isLang, LANGS, t } from "@/lib/i18n";

export const dynamicParams = false;

export function generateStaticParams() {
  return LANGS.map((lang) => ({ lang }));
}

// The root layout owns <html> and <body>; the language segment only marks the content language.
export default async function LangLayout({
  children,
  params,
}: LayoutProps<"/[lang]">) {
  const { lang } = await params;
  if (!isLang(lang)) notFound();
  const [modules, quizModules] = await Promise.all([
    getCurriculum(),
    getQuizCatalog(),
  ]);
  return (
    <div
      lang={lang}
      className="flex flex-1 flex-col pt-[env(safe-area-inset-top)] pr-[env(safe-area-inset-right)] pb-[env(safe-area-inset-bottom)] pl-[env(safe-area-inset-left)]"
    >
      <ProgressProvider
        modules={modules.map((m) => m.slug)}
        quizKeys={quizModules.flatMap((m) =>
          m.quizzes.map((q) => `${m.slug}-${q.quizSlug}`),
        )}
      >
        <TelegramBridge lang={lang} />
        <header className="sticky top-[env(safe-area-inset-top)] z-20 border-b bg-background/80 backdrop-blur">
          <div className="mx-auto flex max-w-7xl items-center gap-4 px-4 py-3">
            <Link href={`/${lang}/`} className="font-semibold">
              {t(lang, "siteName")}
            </Link>
            <Link
              href={`/${lang}/quizzes/`}
              className="text-sm text-muted-foreground hover:underline"
            >
              {t(lang, "quizzes")}
            </Link>
            <SyncBadge lang={lang} />
          </div>
        </header>
        <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8">
          {children}
        </main>
      </ProgressProvider>
    </div>
  );
}
