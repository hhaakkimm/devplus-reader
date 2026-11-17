import Link from "next/link";
import { t } from "@/lib/i18n";

// Static export: this becomes out/404.html and has no language of its own, so it offers both.
export default function NotFound() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-start justify-center gap-4 px-4">
      <h1 className="text-3xl font-semibold">
        {t("ru", "notFound")} / {t("en", "notFound")}
      </h1>
      <Link href="/ru/" className="hover:underline">
        {t("ru", "backToProgramme")}
      </Link>
      <Link href="/en/" className="hover:underline">
        {t("en", "backToProgramme")}
      </Link>
    </main>
  );
}
