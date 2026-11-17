// Gives h2/h3 stable ids (so the table of contents can link to them) and collects them in document order.
export type TocItem = { level: 2 | 3; text: string; id: string };

type Node = {
  type: string;
  depth?: number;
  value?: string;
  children?: Node[];
  data?: { hProperties?: Record<string, unknown> };
};

const textOf = (n: Node): string =>
  n.value ?? (n.children ?? []).map(textOf).join("");

// Letters and digits of any alphabet stay (the lessons are Russian), everything else becomes a dash.
const slug = (text: string) =>
  text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "") || "section";

export function headingIds(out: TocItem[]) {
  return () => (tree: Node) => {
    const seen = new Map<string, number>();
    const walk = (n: Node) => {
      if (n.type === "heading" && (n.depth === 2 || n.depth === 3)) {
        const text = textOf(n).trim();
        const base = slug(text);
        const count = (seen.get(base) ?? 0) + 1;
        seen.set(base, count);
        const id = count === 1 ? base : `${base}-${count}`;
        n.data = { ...n.data, hProperties: { ...n.data?.hProperties, id } };
        out.push({ level: n.depth, text, id });
      }
      n.children?.forEach(walk);
    };
    walk(tree);
  };
}
