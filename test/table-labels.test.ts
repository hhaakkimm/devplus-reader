import { describe, expect, it } from "vitest";
import { tableLabels } from "@/lib/table-labels";

type N = {
  type: string;
  value?: string;
  children?: N[];
  data?: { hProperties?: Record<string, unknown> };
};

const text = (value: string): N => ({ type: "text", value });
const cell = (...children: N[]): N => ({ type: "tableCell", children });
const row = (...cells: N[]): N => ({ type: "tableRow", children: cells });
const table = (...rows: N[]): N => ({ type: "table", children: rows });
const root = (...children: N[]): N => ({ type: "root", children });
const run = (tree: N) => tableLabels()()(tree);
const label = (c: N) => c.data?.hProperties?.["data-label"];

describe("tableLabels", () => {
  it("labels body cells with the header text of the same column", () => {
    const body = row(cell(text("a")), cell(text("b")));
    run(
      root(
        table(
          row(cell(text("Name")), cell(text("Meaning"))),
          body,
          row(cell(text("c")), cell(text("d"))),
        ),
      ),
    );
    expect(body.children!.map(label)).toEqual(["Name", "Meaning"]);
  });

  it("does not label header cells", () => {
    const head = row(cell(text("Name")));
    run(root(table(head, row(cell(text("a"))))));
    expect(label(head.children![0])).toBeUndefined();
    expect(head.children![0].data).toBeUndefined();
  });

  it("skips an empty header", () => {
    const body = row(cell(text("a")), cell(text("b")));
    run(root(table(row(cell(), cell(text("  "))), body)));
    expect(body.children!.map(label)).toEqual([undefined, undefined]);
  });

  it("leaves a cell beyond the header unlabelled", () => {
    const body = row(cell(text("a")), cell(text("b")), cell(text("c")));
    run(root(table(row(cell(text("H1")), cell(text("H2"))), body)));
    expect(body.children!.map(label)).toEqual(["H1", "H2", undefined]);
  });

  it("reduces inline code, bold and links in the header to their text", () => {
    const body = row(cell(text("a")));
    run(
      root(
        table(
          row(
            cell(
              text("Use "),
              { type: "inlineCode", value: "O(1)" },
              text(" and "),
              { type: "strong", children: [text("bold")] },
              text(" "),
              { type: "link", children: [text("docs")] },
            ),
          ),
          body,
        ),
      ),
    );
    expect(label(body.children![0])).toBe("Use O(1) and bold docs");
  });

  it("handles a table without body rows", () => {
    const head = row(cell(text("Only")));
    expect(() => run(root(table(head)))).not.toThrow();
    expect(() => run(root(table()))).not.toThrow();
  });

  it("keeps the tables of one page apart", () => {
    const b1 = row(cell(text("x")), cell(text("y")));
    const b2 = row(cell(text("x")), cell(text("y")));
    run(
      root(
        table(row(cell(text("A")), cell(text("B"))), b1),
        table(row(cell(text("C")), cell()), b2),
      ),
    );
    expect(b1.children!.map(label)).toEqual(["A", "B"]);
    expect(b2.children!.map(label)).toEqual(["C", undefined]);
  });

  it("keeps the markup inside the cells", () => {
    const content = [
      text("see "),
      { type: "inlineCode", value: "x" },
      { type: "strong", children: [text("!")] },
    ];
    const c = cell(...content);
    run(root(table(row(cell(text("H"))), row(c))));
    expect(c.children).toEqual(content);
  });

  it("keeps the existing hProperties of a cell", () => {
    const c = cell(text("a"));
    c.data = { hProperties: { align: "right" } };
    run(root(table(row(cell(text("H"))), row(c))));
    expect(c.data!.hProperties).toEqual({ align: "right", "data-label": "H" });
  });

  it("finds a table nested in other nodes", () => {
    const c = cell(text("a"));
    run(
      root({
        type: "blockquote",
        children: [table(row(cell(text("H"))), row(c))],
      }),
    );
    expect(label(c)).toBe("H");
  });
});
