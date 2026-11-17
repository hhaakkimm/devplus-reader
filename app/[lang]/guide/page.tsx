import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { LangToggle } from "@/components/lang-toggle";
import { guide } from "@/lib/guide";
import { isLang, t } from "@/lib/i18n";

export async function generateMetadata({
  params,
}: PageProps<"/[lang]/guide">): Promise<Metadata> {
  const { lang } = await params;
  return {
    title: isLang(lang) ? `${t(lang, "guide")} | devplus` : "devplus",
  };
}

export default async function GuidePage({
  params,
}: PageProps<"/[lang]/guide">) {
  const { lang } = await params;
  if (!isLang(lang)) notFound();
  const { intro, sections } = guide[lang];
  return (
    <div className="mx-auto max-w-3xl">
      <div className="flex items-start justify-between gap-3">
        <h1 className="text-3xl font-semibold">{t(lang, "guide")}</h1>
        <LangToggle lang={lang} path="/guide/" />
      </div>
      <p className="mt-2 text-muted-foreground">{intro}</p>
      <div className="mt-8 space-y-8">
        {sections.map((s) => (
          <section key={s.title}>
            <h2 className="text-xl font-semibold">{s.title}</h2>
            {s.text?.map((p) => (
              <p key={p} className="mt-3 leading-relaxed">
                {p}
              </p>
            ))}
            {s.items && (
              <ul className="mt-3 list-disc space-y-2 pl-5 leading-relaxed">
                {s.items.map((i) => (
                  <li key={i}>{i}</li>
                ))}
              </ul>
            )}
          </section>
        ))}
      </div>
    </div>
  );
}
