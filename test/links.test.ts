import { afterEach, describe, expect, it, vi } from "vitest";
import { BASE_PATH, rewriteLinks, rewriteUrl } from "@/lib/links";

const o = {
  lang: "ru" as const,
  basePath: "/devplus-reader",
  hasEn: () => false,
  file: "21-core-concepts/02-caching.mdx",
};

afterEach(() => vi.restoreAllMocks());

describe("rewriteUrl", () => {
  it("exports the base path used by next.config.ts", () => {
    expect(BASE_PATH).toBe("/devplus-reader");
  });

  it("prefixes /content assets with the base path", () => {
    expect(rewriteUrl("/content/a/b.svg", o)).toBe(
      "/devplus-reader/content/a/b.svg",
    );
  });

  it("rewrites a lesson link to the page language with a trailing slash", () => {
    expect(rewriteUrl("/lessons/21-core-concepts/02-caching", o)).toBe(
      "/devplus-reader/ru/lessons/21-core-concepts/02-caching/",
    );
  });

  it("drops ?lang=en and keeps the anchor", () => {
    expect(rewriteUrl("/lessons/m/l?lang=en#x", o)).toBe(
      "/devplus-reader/ru/lessons/m/l/#x",
    );
  });

  it("drops ?lang=en without an anchor", () => {
    expect(rewriteUrl("/lessons/m/l?lang=en", o)).toBe(
      "/devplus-reader/ru/lessons/m/l/",
    );
  });

  it("uses /en/ when the page is EN and the lesson has an EN version", () => {
    const hasEn = vi.fn(() => true);
    expect(rewriteUrl("/lessons/m/l", { ...o, lang: "en", hasEn })).toBe(
      "/devplus-reader/en/lessons/m/l/",
    );
    expect(hasEn).toHaveBeenCalledWith("m/l");
  });

  it("falls back to RU and warns with the file name when EN is missing", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(rewriteUrl("/lessons/m/l", { ...o, lang: "en" })).toBe(
      "/devplus-reader/ru/lessons/m/l/",
    );
    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0][0])).toContain(o.file);
  });

  it("does not warn for RU pages", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    rewriteUrl("/lessons/m/l", o);
    expect(warn).not.toHaveBeenCalled();
  });

  it.each([
    "https://x.y",
    "http://x.y/lessons/m/l",
    "mailto:a@b",
    "tel:+123",
    "#anchor",
    "relative/path",
    "",
    "/other/path",
  ])("leaves %j untouched", (url) => {
    expect(rewriteUrl(url, o)).toBe(url);
  });

  it("leaves a /lessons URL with a trailing slash untouched (strict regexp)", () => {
    expect(rewriteUrl("/lessons/m/l/", o)).toBe("/lessons/m/l/");
  });

  it("leaves a /lessons URL with extra path segments untouched (strict regexp)", () => {
    expect(rewriteUrl("/lessons/m/l/extra", o)).toBe("/lessons/m/l/extra");
    expect(rewriteUrl("/lessons/m", o)).toBe("/lessons/m");
  });
});

describe("rewriteLinks", () => {
  it("rewrites image and link nodes at any depth, not inlineCode or text", () => {
    type N = { type: string; url?: string; value?: string; children?: N[] };
    const tree: N = {
      type: "root",
      children: [
        {
          type: "paragraph",
          children: [
            { type: "image", url: "/content/x/a.svg" },
            {
              type: "link",
              url: "/lessons/m/l?lang=en#h",
              children: [
                { type: "image", url: "/content/x/b.svg" },
                { type: "text", value: "/content/t" },
              ],
            },
            { type: "link", url: "https://x.y", children: [] },
            { type: "inlineCode", value: "/content/x" },
          ],
        },
      ],
    };
    rewriteLinks(o)()(tree);
    const [img, link, ext, code] = tree.children![0].children!;
    expect(img.url).toBe("/devplus-reader/content/x/a.svg");
    expect(link.url).toBe("/devplus-reader/ru/lessons/m/l/#h");
    expect(link.children![0].url).toBe("/devplus-reader/content/x/b.svg");
    expect(link.children![1].value).toBe("/content/t");
    expect(ext.url).toBe("https://x.y");
    expect(code.value).toBe("/content/x");
  });
});
