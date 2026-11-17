import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { LangToggle } from "@/components/lang-toggle";
import { ProgrammeList } from "@/components/programme-list";
import { getCurriculum } from "@/lib/data";
import { isLang, t } from "@/lib/i18n";
import { navModules } from "@/lib/nav-modules";

export async function generateMetadata({
  params,
}: PageProps<"/[lang]">): Promise<Metadata> {
  const { lang } = await params;
  return {
    title: isLang(lang) ? `devplus: ${t(lang, "programme")}` : "devplus",
  };
}

export default async function Programme({ params }: PageProps<"/[lang]">) {
  const { lang } = await params;
  if (!isLang(lang)) notFound();
  const modules = navModules(await getCurriculum(), lang);
  return (
    <div className="mx-auto max-w-3xl">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-3xl font-semibold">{t(lang, "programme")}</h1>
        <LangToggle lang={lang} path="/" />
      </div>
      <ProgrammeList modules={modules} />
    </div>
  );
}
