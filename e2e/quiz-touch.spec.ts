import { expect, test, type Locator, type Page } from "@playwright/test";

// Longest ranking items of all quizzes (up to 141 characters), and a matching question whose
// options are up to 118 characters (the first question of the Kafka quiz).
const RANKING_QUIZ = "ru/quizzes/patterns/large-blobs/";
const MATCHING_QUIZ = "ru/quizzes/key-technologies/kafka/";

test.beforeEach(async ({ page }) => {
  await page.route("https://telegram.org/**", (route) =>
    route.fulfill({ contentType: "text/javascript", body: "/* stub */" }),
  );
});

const noHorizontalScroll = (page: Page) =>
  page.evaluate(
    () => document.documentElement.scrollWidth <= window.innerWidth,
  );

// Taps through the quiz until a ranking question (or a matching one) is on screen.
async function goToQuestion(
  page: Page,
  url: string,
  kind: "ranking" | "matching",
) {
  await page.goto(url);
  const ranking = page.getByRole("list", { name: "Расставь по порядку" });
  const target = kind === "ranking" ? ranking : page.getByRole("combobox");
  for (let i = 0; i < 15 && !(await target.count()); i++) {
    if (await ranking.count()) {
      await page
        .getByRole("button", { name: /^Опустить:/ })
        .first()
        .click();
      await page.getByRole("button", { name: "Проверить" }).click();
    } else if (await page.getByRole("combobox").count()) {
      for (const select of await page.getByRole("combobox").all())
        await select.selectOption({ index: 1 });
      await page.getByRole("button", { name: "Проверить" }).click();
    } else {
      await page
        .getByRole("group", { name: "Варианты ответа" })
        .getByRole("button")
        .first()
        .click();
    }
    await page.getByRole("button", { name: /^(Дальше|Завершить)$/ }).click();
  }
  await expect(target.first()).toBeVisible();
}

// The line of text under a select (the <option>s hold the same text but are not visible).
const full = (item: Locator, text: string) =>
  item.locator("p").filter({ hasText: text });

async function moveButtonSizes(page: Page) {
  const sizes: { w: number; h: number }[] = [];
  for (const b of await page
    .getByRole("button", { name: /^(Поднять|Опустить):/ })
    .all()) {
    const box = (await b.boundingBox())!;
    sizes.push({ w: box.width, h: box.height });
  }
  expect(sizes.length).toBeGreaterThan(0);
  return sizes;
}

test("ranking buttons are at least 44x44 on a phone and the row does not overflow", async ({
  page,
}) => {
  await goToQuestion(page, RANKING_QUIZ, "ranking");
  for (const { w, h } of await moveButtonSizes(page)) {
    expect(w).toBeGreaterThanOrEqual(44);
    expect(h).toBeGreaterThanOrEqual(44);
  }
  expect(await noHorizontalScroll(page)).toBe(true);
  // The item text stays in the row next to the buttons, not under them.
  const row = page.getByRole("listitem").first();
  const text = await row.locator("span").nth(1).boundingBox();
  const button = await row.getByRole("button").first().boundingBox();
  expect(text!.x + text!.width).toBeLessThanOrEqual(button!.x);
  await page.getByRole("button", { name: "Проверить" }).click();
  expect(await noHorizontalScroll(page)).toBe(true);
});

test.describe("on a desktop", () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test("ranking buttons keep their compact size", async ({ page }) => {
    await goToQuestion(page, RANKING_QUIZ, "ranking");
    for (const { w, h } of await moveButtonSizes(page)) {
      expect(w).toBeLessThanOrEqual(40);
      expect(h).toBeLessThanOrEqual(40);
    }
  });
});

test("a chosen long matching option is shown in full under its select", async ({
  page,
}) => {
  await goToQuestion(page, MATCHING_QUIZ, "matching");
  const select = page.getByRole("combobox").first();
  const options = await select.locator("option").allTextContents();
  const longest = options.reduce((a, b) => (b.length > a.length ? b : a));
  expect(longest.length).toBeGreaterThan(100);
  const item = page.getByRole("listitem").first();
  // Nothing is shown before a choice is made.
  await expect(full(item, longest)).toHaveCount(0);
  await select.selectOption({ label: longest });
  await expect(full(item, longest)).toBeVisible();
  // It stays after checking, and the page still does not scroll sideways.
  await page.getByRole("combobox").nth(1).selectOption({ index: 2 });
  await page.getByRole("combobox").nth(2).selectOption({ index: 3 });
  await page.getByRole("combobox").nth(3).selectOption({ index: 4 });
  await page.getByRole("button", { name: "Проверить" }).click();
  await expect(full(item, longest)).toBeVisible();
  expect(await noHorizontalScroll(page)).toBe(true);
});
