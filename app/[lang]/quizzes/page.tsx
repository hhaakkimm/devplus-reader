import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BestScore } from "@/components/best-score";
import { LangToggle } from "@/components/lang-toggle";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getQuizCatalog } from "@/lib/data";
import { fill, isLang, t } from "@/lib/i18n";

export async function generateMetadata({
  params,
}: PageProps<"/[lang]/quizzes">): Promise<Metadata> {
  const { lang } = await params;
  return {
    title: isLang(lang) ? `${t(lang, "quizzes")} | devplus` : "devplus",
  };
}

export default async function QuizzesPage({
  params,
}: PageProps<"/[lang]/quizzes">) {
  const { lang } = await params;
  if (!isLang(lang)) notFound();
  const catalog = await getQuizCatalog();
  return (
    <div className="mx-auto max-w-3xl">
      <div className="flex items-start justify-between gap-3">
        <h1 className="text-3xl font-semibold">{t(lang, "quizzes")}</h1>
        <LangToggle lang={lang} path="/quizzes/" />
      </div>
      <p className="mt-2 text-muted-foreground">{t(lang, "quizzesIntro")}</p>
      {catalog.length === 0 && (
        <p className="mt-6 text-muted-foreground">{t(lang, "noQuizzes")}</p>
      )}
      <div className="mt-6 space-y-4">
        {catalog.map((m) => (
          <Card key={m.slug} role="region" aria-label={m.title}>
            <CardHeader>
              <CardTitle className="text-lg">{m.title}</CardTitle>
            </CardHeader>
            <CardContent>
              <ul>
                {m.quizzes.map((q) => {
                  // The English page exists only with an .en.json twin; otherwise the Russian quiz.
                  const quizLang = lang === "en" && q.en ? "en" : "ru";
                  return (
                    <li key={q.slug}>
                      <Link
                        href={`/${quizLang}/quizzes/${q.slug}/`}
                        className="-mx-2 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 rounded-md px-2 py-2 transition-colors hover:bg-muted"
                      >
                        <span className="min-w-0 font-medium">
                          {quizLang === "en" ? q.en!.title : q.title}
                        </span>
                        <span className="flex items-center gap-2 text-sm text-muted-foreground">
                          {fill(t(lang, "quizQuestions"), { n: q.count })}
                          <BestScore lang={lang} quiz={q.slug} />
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
