import type { Metadata } from "next";
import { compileMDX } from "next-mdx-remote/rsc";
import Link from "next/link";
import { notFound } from "next/navigation";
import remarkGfm from "remark-gfm";
import { BestScore } from "@/components/best-score";
import { CurriculumNav } from "@/components/curriculum-nav";
import { LangToggle } from "@/components/lang-toggle";
import { LessonToc } from "@/components/lesson-toc";
import { ProgressToggle } from "@/components/progress-toggle";
import { ScrollToActive } from "@/components/scroll-to-active";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { CONTENT_DIR, loadLesson } from "@/lib/content";
import { getCurriculum } from "@/lib/data";
import { fill, isLang, LANGS, t } from "@/lib/i18n";
import { BASE_PATH, rewriteLinks } from "@/lib/links";
import { lessonLink, navModules } from "@/lib/nav-modules";
import { loadQuiz } from "@/lib/quizzes";
import { headingIds, type TocItem } from "@/lib/toc";

export const dynamicParams = false;

// An English page exists only for a lesson with an .en.mdx twin.
export async function generateStaticParams() {
  const modules = await getCurriculum();
  return LANGS.flatMap((lang) =>
    modules.flatMap((m) =>
      m.lessons
        .filter((l) => lang === "ru" || l.en)
        .map((l) => ({ lang, module: m.slug, lesson: l.lessonSlug })),
    ),
  );
}

export async function generateMetadata({
  params,
}: PageProps<"/[lang]/lessons/[module]/[lesson]">): Promise<Metadata> {
  const { lang, module: moduleSlug, lesson: lessonSlug } = await params;
  const lesson = (await getCurriculum())
    .find((m) => m.slug === moduleSlug)
    ?.lessons.find((l) => l.lessonSlug === lessonSlug);
  const title = lang === "en" && lesson?.en ? lesson.en.title : lesson?.title;
  return { title: title ? `${title} | devplus` : "devplus" };
}

// `not-prose`: the shadcn table has its own spacing, prose styles would double it.
// Tables stay sans and 1rem: the serif article size is too big for dense cells.
function MdxTable(props: React.ComponentProps<"table">) {
  return (
    <div className="not-prose my-6 rounded-lg border bg-card px-2 font-sans text-base">
      <Table {...props} />
    </div>
  );
}

export default async function LessonPage({
  params,
}: PageProps<"/[lang]/lessons/[module]/[lesson]">) {
  const { lang, module: moduleSlug, lesson: lessonSlug } = await params;
  if (!isLang(lang)) notFound();
  const [lesson, modules] = await Promise.all([
    loadLesson(moduleSlug, lessonSlug),
    getCurriculum(),
  ]);
  if (!lesson) notFound();
  const en = lang === "en";
  if (en && lesson.enSource === undefined) notFound();
  const mod = modules.find((m) => m.slug === moduleSlug);
  const at = mod ? mod.lessons.findIndex((l) => l.slug === lesson.slug) : -1;
  const prev =
    mod && at > 0 ? lessonLink(lang, mod.lessons[at - 1]) : undefined;
  const next =
    mod && at >= 0 && mod.lessons[at + 1]
      ? lessonLink(lang, mod.lessons[at + 1])
      : undefined;
  // loadQuiz("en") gives the Russian quiz when there is no English twin; hasEn says which one it is.
  const quiz = lesson.quiz
    ? await loadQuiz(moduleSlug, lesson.quiz, CONTENT_DIR, lang)
    : null;
  const quizLang = en && quiz?.hasEn ? "en" : "ru";
  const hasEn = (slug: string) =>
    modules.some((m) => m.lessons.some((l) => l.slug === slug && l.en));
  // Compiled here (not in <MDXRemote>) so the plugin has filled `toc` before the page renders.
  const toc: TocItem[] = [];
  const { content } = await compileMDX({
    source: en ? lesson.enSource! : lesson.source,
    options: {
      mdxOptions: {
        remarkPlugins: [
          remarkGfm,
          headingIds(toc),
          rewriteLinks({
            lang,
            basePath: BASE_PATH,
            hasEn,
            file: `content/${moduleSlug}/${lessonSlug}${en ? ".en" : ""}.mdx`,
          }),
        ],
      },
    },
    components: {
      table: MdxTable,
      thead: TableHeader,
      tbody: TableBody,
      tr: TableRow,
      th: TableHead,
      td: TableCell,
    },
  });
  const nav = (
    <CurriculumNav
      lang={lang}
      modules={navModules(modules, lang)}
      current={lesson.slug}
    />
  );
  return (
    <div className="lg:grid lg:grid-cols-[15rem_minmax(0,1fr)] lg:gap-8">
      <aside
        aria-label={t(lang, "programmeStructure")}
        className="mb-6 lg:mb-0"
      >
        {/* Narrow screens: a fold above the article. From lg: a sticky column on the left. */}
        <details className="rounded-lg border bg-card px-3 py-2 lg:hidden">
          <summary className="cursor-pointer text-sm font-medium">
            {t(lang, "contents")}
          </summary>
          <div className="mt-2 max-h-80 overflow-y-auto">{nav}</div>
        </details>
        <div className="sticky top-20 hidden lg:block">
          <ScrollToActive className="max-h-[calc(100vh-6rem)] overflow-y-auto pr-2">
            {nav}
          </ScrollToActive>
        </div>
      </aside>
      <article className="mx-auto w-full max-w-[42.5rem] lg:mx-0">
        <div className="flex items-center justify-between gap-3">
          {mod ? (
            <p className="text-sm text-muted-foreground">{mod.title}</p>
          ) : (
            <span />
          )}
          {lesson.en && (
            <LangToggle lang={lang} path={`/lessons/${lesson.slug}/`} />
          )}
        </div>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight sm:text-4xl">
          {en ? lesson.en!.title : lesson.title}
        </h1>
        <div id="lesson-article" className="relative">
          <LessonToc lang={lang} articleId="lesson-article" items={toc} />
          <div className="article prose prose-neutral dark:prose-invert mt-8 max-w-none font-serif prose-headings:font-sans prose-headings:scroll-mt-20 prose-headings:tracking-tight prose-a:font-normal prose-a:text-primary prose-a:underline prose-a:decoration-primary/40 prose-a:underline-offset-4 hover:prose-a:decoration-primary prose-blockquote:border-l-2 prose-blockquote:border-primary/40 prose-blockquote:font-normal prose-blockquote:text-muted-foreground prose-img:mx-auto prose-img:rounded-lg prose-img:border prose-img:bg-white prose-img:p-2 prose-hr:my-10">
            {content}
          </div>
        </div>
        {quiz && (
          <Card className="mt-8">
            <CardHeader>
              <CardTitle>{t(lang, "checkYourself")}</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap items-center gap-3">
              <Link
                href={`/${quizLang}/quizzes/${quiz.slug}/`}
                className="font-medium hover:underline"
              >
                {quiz.title}
              </Link>
              <span className="text-sm text-muted-foreground">
                {fill(t(lang, "quizQuestions"), { n: quiz.questions.length })}
              </span>
              <BestScore lang={lang} quiz={quiz.slug} />
            </CardContent>
          </Card>
        )}
        <div className="mt-8 flex items-center gap-4">
          <ProgressToggle lang={lang} slug={lesson.slug} />
          <Link
            href={`/${lang}/`}
            className="text-sm text-muted-foreground hover:underline"
          >
            {t(lang, "backToProgramme")}
          </Link>
        </div>
        {(prev || next) && (
          <nav
            aria-label={t(lang, "adjacentLessons")}
            className="mt-8 grid gap-3 border-t pt-6 sm:grid-cols-2"
          >
            {prev ? (
              <Link
                href={prev.href}
                className="rounded-lg border bg-card p-3 text-sm transition-colors hover:bg-muted"
              >
                <span className="block text-xs text-muted-foreground">
                  ← {t(lang, "previous")}
                </span>
                {prev.title}
              </Link>
            ) : (
              <span />
            )}
            {next && (
              <Link
                href={next.href}
                className="rounded-lg border bg-card p-3 text-right text-sm transition-colors hover:bg-muted sm:col-start-2"
              >
                <span className="block text-xs text-muted-foreground">
                  {t(lang, "next")} →
                </span>
                {next.title}
              </Link>
            )}
          </nav>
        )}
      </article>
    </div>
  );
}
