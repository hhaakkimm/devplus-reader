import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { LangToggle } from "@/components/lang-toggle";
import { QuizRunner } from "@/components/quiz";
import { getQuizCatalog } from "@/lib/data";
import { fill, isLang, LANGS, t } from "@/lib/i18n";
import { loadQuiz } from "@/lib/quizzes";

export const dynamicParams = false;

// An English page exists only for a quiz with an .en.json twin.
export async function generateStaticParams() {
  const catalog = await getQuizCatalog();
  return LANGS.flatMap((lang) =>
    catalog.flatMap((m) =>
      m.quizzes
        .filter((q) => lang === "ru" || q.en)
        .map((q) => ({ lang, module: m.slug, quiz: q.quizSlug })),
    ),
  );
}

export async function generateMetadata({
  params,
}: PageProps<"/[lang]/quizzes/[module]/[quiz]">): Promise<Metadata> {
  const { lang, module: moduleSlug, quiz: quizSlug } = await params;
  const q = (await getQuizCatalog())
    .find((m) => m.slug === moduleSlug)
    ?.quizzes.find((x) => x.quizSlug === quizSlug);
  const title = lang === "en" && q?.en ? q.en.title : q?.title;
  return { title: title ? `${title} | devplus` : "devplus" };
}

export default async function QuizPage({
  params,
}: PageProps<"/[lang]/quizzes/[module]/[quiz]">) {
  const { lang, module: moduleSlug, quiz: quizSlug } = await params;
  if (!isLang(lang)) notFound();
  const quiz = await loadQuiz(moduleSlug, quizSlug, undefined, lang);
  if (!quiz || (lang === "en" && !quiz.hasEn)) notFound();
  return (
    <article className="mx-auto max-w-3xl">
      <div className="flex items-start justify-between gap-3">
        <h1 className="text-3xl font-semibold">{quiz.title}</h1>
        {quiz.hasEn && (
          <LangToggle lang={lang} path={`/quizzes/${quiz.slug}/`} />
        )}
      </div>
      <p className="mt-2 text-sm text-muted-foreground">
        {fill(t(lang, "quizQuestions"), { n: quiz.questions.length })}
        {quiz.source && (
          <>
            {" · "}
            <a
              href={quiz.source}
              target="_blank"
              rel="noopener noreferrer"
              className="underline"
            >
              {t(lang, "sourceLink")}
            </a>
            {lang === "ru" && ` (${t(lang, "translation")})`}
          </>
        )}
      </p>
      <div className="mt-6">
        <QuizRunner quiz={quiz} lang={lang} />
      </div>
    </article>
  );
}
