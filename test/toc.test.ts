import { describe, expect, it } from "vitest";
import { headingIds, type TocItem } from "@/lib/toc";

const h = (text: string, depth = 2) => ({
  type: "heading",
  depth,
  children: [{ type: "text", value: text }],
});

describe("headingIds", () => {
  it("numbers repeated headings and keeps Cyrillic", () => {
    const out: TocItem[] = [];
    headingIds(out)()({
      type: "root",
      children: [h("Что это"), h("Что это"), h("Что это", 3), h("Intro")],
    });
    expect(out.map((i) => i.id)).toEqual([
      "что-это",
      "что-это-2",
      "что-это-3",
      "intro",
    ]);
  });
});
