// Copies each column's header text into data-label of the body cells below it: on a phone the CSS
// (components/ui/table.tsx) stacks a row into a card and prints that label before the value.
// Must run after remark-gfm, which is what turns pipe tables into `table` nodes.
type Node = {
  type: string;
  value?: string;
  children?: Node[];
  data?: { hProperties?: Record<string, unknown> };
};

const textOf = (n: Node): string =>
  n.value ?? (n.children ?? []).map(textOf).join("");

export function tableLabels() {
  return () => (tree: Node) => {
    const walk = (n: Node) => {
      if (n.type === "table") {
        const [head, ...body] = n.children ?? [];
        const labels = (head?.children ?? []).map((c) => textOf(c).trim());
        for (const row of body)
          row.children?.forEach((cell, i) => {
            if (!labels[i]) return;
            cell.data = {
              ...cell.data,
              hProperties: {
                ...cell.data?.hProperties,
                "data-label": labels[i],
              },
            };
          });
      }
      n.children?.forEach(walk);
    };
    walk(tree);
  };
}
