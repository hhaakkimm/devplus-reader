// The lessons were written for the full devplus app: this rewrites their /content and /lessons links for the reader.
import type { Lang } from "@/lib/i18n";

export const BASE_PATH = "/devplus-reader";

type Opts = {
  lang: Lang;
  basePath: string;
  hasEn: (lessonSlug: string) => boolean; // lessonSlug is "module/lesson"
  file: string;
};

type Node = { type: string; url?: string; children?: Node[] };

// shortcut: only the exact /lessons/<m>/<l> form (optional ?query, #anchor) is matched; a trailing slash or extra segments are left as is, widen if lessons start using them.
const LESSON = /^\/lessons\/([a-z0-9-]+)\/([a-z0-9-]+)(?:\?[^#]*)?(#.*)?$/;

export function rewriteUrl(url: string, o: Opts): string {
  if (url.startsWith("/content/")) return o.basePath + url;
  const m = LESSON.exec(url);
  if (!m) return url;
  const [, mod, lesson, anchor = ""] = m;
  let lang = o.lang;
  if (lang === "en" && !o.hasEn(`${mod}/${lesson}`)) {
    console.warn(
      `${o.file}: no English version of ${mod}/${lesson}, linking to the Russian page`,
    );
    lang = "ru";
  }
  return `${o.basePath}/${lang}/lessons/${mod}/${lesson}/${anchor}`;
}

export function rewriteLinks(o: Opts) {
  return () => (tree: Node) => {
    const walk = (n: Node) => {
      if ((n.type === "image" || n.type === "link") && n.url !== undefined) {
        n.url = rewriteUrl(n.url, o);
      }
      n.children?.forEach(walk);
    };
    walk(tree);
  };
}
