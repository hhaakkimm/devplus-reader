import { expect, test, type Page } from "@playwright/test";

// A very wide table (rows of 300+ characters), a seven-column one and a short two-column one.
const LESSONS = [
  "lessons/lld/problem-breakdowns-rate-limiter/",
  "lessons/ai-coding/problem-breakdowns-maximize-unique-chars/",
  "lessons/lld/problem-breakdowns-inventory-management/",
  // Four of six columns are empty here: empty cells must not leave blank strips in a card.
  "lessons/sd-prep/how-to-prepare/",
];
const LANGS = ["ru", "en"];

test.beforeEach(async ({ page }) => {
  await page.route("https://telegram.org/**", (route) =>
    route.fulfill({ contentType: "text/javascript", body: "/* stub */" }),
  );
});

type TableFacts = {
  innerScroll: boolean;
  headers: string[];
  mismatched: string[];
  widest: number;
  container: number;
  display: string;
  theadDisplay: string;
  rows: number;
  emptyShown: number;
};

// Per table: does its container scroll, does every body cell carry the label of its column,
// how wide is the widest cell against the container.
const facts = (page: Page) =>
  page.evaluate((): TableFacts[] =>
    [...document.querySelectorAll("table")].map((table) => {
      const box = table.parentElement!;
      const headers = [...table.querySelectorAll("thead th")].map((th) =>
        th.textContent!.trim(),
      );
      const mismatched: string[] = [];
      let widest = 0;
      for (const tr of table.querySelectorAll("tbody tr"))
        [...tr.children].forEach((td, i) => {
          widest = Math.max(widest, td.getBoundingClientRect().width);
          if (headers[i] && td.getAttribute("data-label") !== headers[i])
            mismatched.push(
              `${headers[i]} != ${td.getAttribute("data-label")}`,
            );
        });
      return {
        innerScroll: box.scrollWidth > box.clientWidth,
        headers,
        mismatched,
        widest,
        container: box.clientWidth,
        display: getComputedStyle(table).display,
        theadDisplay: getComputedStyle(table.tHead!).display,
        rows: table.querySelectorAll("tbody tr").length,
        emptyShown: [...table.querySelectorAll("td:empty")].filter(
          (td) => getComputedStyle(td).display !== "none",
        ).length,
      };
    }),
  );

for (const lang of LANGS)
  for (const lesson of LESSONS)
    test.describe(`${lang}/${lesson}`, () => {
      test("narrow screen: tables stack into labelled cards", async ({
        page,
      }) => {
        await page.goto(`${lang}/${lesson}`);
        const tables = await facts(page);
        expect(tables.length).toBeGreaterThan(0);
        for (const t of tables) {
          expect(t.innerScroll).toBe(false);
          expect(t.mismatched).toEqual([]);
          expect(t.emptyShown).toBe(0);
          expect(t.widest).toBeLessThanOrEqual(t.container);
        }
        expect(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= window.innerWidth,
          ),
        ).toBe(true);
        // The header row is hidden visually but still read by screen readers.
        const head = page.locator("table").first().locator("thead");
        expect(
          await head.evaluate((e) => e.getBoundingClientRect().width),
        ).toBeLessThanOrEqual(1);
        await expect(
          page.locator("table").first().getByRole("columnheader").first(),
        ).toBeAttached();
        expect(
          await page.locator("table").first().getByRole("columnheader").count(),
        ).toBeGreaterThan(0);
      });

      test.describe("wide screen", () => {
        test.use({ viewport: { width: 1280, height: 800 } });

        test("tables stay tables", async ({ page }) => {
          await page.goto(`${lang}/${lesson}`);
          const tables = await facts(page);
          expect(tables.length).toBeGreaterThan(0);
          for (const t of tables) {
            expect(t.display).toBe("table");
            expect(t.theadDisplay).toBe("table-header-group");
          }
          await expect(
            page.locator("table").first().locator("thead th").first(),
          ).toBeVisible();
          await expect(
            page.locator("[data-slot=table-container]").first(),
          ).toBeAttached();
        });
      });
    });

test("wide screen: a very wide table still scrolls in its container", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("ru/lessons/lld/problem-breakdowns-rate-limiter/");
  const tables = await facts(page);
  expect(tables.some((t) => t.innerScroll)).toBe(true);
});
