import { expect, test, type Page } from "@playwright/test";

const MODULE = "Подготовка к system design";
const LESSON = "ru/lessons/sd-prep/introduction/";
const EN_LESSON = "en/lessons/sd-prep/introduction/";

// Every test gets a fresh browser context, but clear storage anyway so a test never leans on another.
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    if (!sessionStorage.getItem("cleared")) {
      localStorage.clear();
      sessionStorage.setItem("cleared", "1");
    }
  });
});

const noHorizontalScroll = (page: Page) =>
  page.evaluate(
    () => document.documentElement.scrollWidth <= window.innerWidth,
  );

// The module counter in the lesson's navigation (the fold above the article on a phone).
async function navCounter(page: Page, lang: "ru" | "en" = "ru") {
  await page
    .getByRole("complementary")
    .getByText(lang === "ru" ? "Содержание" : "Contents")
    .click();
  return page
    .getByRole("navigation", {
      name: lang === "ru" ? "Программа" : "Programme",
    })
    .locator("summary", { hasText: MODULE })
    .getByText(/^\d+\/\d+$/);
}

test("the programme shows modules with a 0/N counter", async ({ page }) => {
  await page.goto("ru/");
  await expect(page.getByRole("heading", { name: "Программа" })).toBeVisible();
  const programme = page.getByRole("button", { name: new RegExp(MODULE) });
  await expect(programme).toBeVisible();
  await expect(programme.getByText(/^0\/\d+$/)).toBeVisible();
  expect(await noHorizontalScroll(page)).toBe(true);
});

test("a lesson opens from the programme", async ({ page }) => {
  await page.goto("ru/");
  await page.getByRole("button", { name: new RegExp(MODULE) }).click();
  await page
    .getByRole("region", { name: MODULE })
    .getByRole("link", { name: "Введение", exact: true })
    .click();
  await expect(page).toHaveURL(new RegExp(`${LESSON}$`));
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Введение");
  expect(await noHorizontalScroll(page)).toBe(true);
});

test("marking a lesson done updates the navigation and survives a reload", async ({
  page,
}) => {
  await page.goto(LESSON);
  const counter = await navCounter(page);
  await expect(counter).toHaveText(/^0\//);
  await page.getByRole("button", { name: "Отметить пройденным" }).click();
  await expect(counter).toHaveText(/^1\//);
  await expect(
    page.getByRole("button", { name: "Снять отметку" }),
  ).toBeVisible();

  await page.reload();
  await expect(
    page.getByRole("button", { name: "Снять отметку" }),
  ).toBeVisible();
  await expect(await navCounter(page)).toHaveText(/^1\//);

  await page.getByRole("button", { name: "Снять отметку" }).click();
  await expect(
    page.getByRole("button", { name: "Отметить пройденным" }),
  ).toBeVisible();
});

test("an English lesson has an English title and toggles to its Russian twin and back", async ({
  page,
}) => {
  await page.goto(EN_LESSON);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Introduction",
  );
  await expect(
    page.getByRole("button", { name: "Mark as done" }),
  ).toBeVisible();
  expect(await noHorizontalScroll(page)).toBe(true);

  await page
    .getByRole("navigation", { name: "Material language" })
    .getByRole("link", { name: "RU" })
    .click();
  await expect(page).toHaveURL(new RegExp(`${LESSON}$`));
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Введение");

  await page
    .getByRole("navigation", { name: "Язык материала" })
    .getByRole("link", { name: "EN" })
    .click();
  await expect(page).toHaveURL(new RegExp(`${EN_LESSON}$`));
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Introduction",
  );
});

test("an unknown language is a 404", async ({ page }) => {
  const res = await page.goto("de/");
  expect(res?.status()).toBe(404);
});

test("a mark survives switching the language and a reload", async ({
  page,
}) => {
  await page.goto(LESSON);
  await page.getByRole("button", { name: "Отметить пройденным" }).click();
  await expect(
    page.getByRole("button", { name: "Снять отметку" }),
  ).toBeVisible();

  await page
    .getByRole("navigation", { name: "Язык материала" })
    .getByRole("link", { name: "EN" })
    .click();
  await expect(page).toHaveURL(new RegExp(`${EN_LESSON}$`));
  // Right after the navigation: the same store, no flash of an unmarked lesson.
  await expect(page.getByRole("button", { name: "Unmark" })).toBeVisible();
  await expect(await navCounter(page, "en")).toHaveText(/^1\//);

  await page.reload();
  await expect(page.getByRole("button", { name: "Unmark" })).toBeVisible();
  await expect(await navCounter(page, "en")).toHaveText(/^1\//);
});

// The server HTML is what runs before hydration: a click on an enabled button then would hit no store and be lost.
test("the mark button is disabled in the server HTML", async ({ request }) => {
  const res = await request.get(LESSON);
  const html = await res.text();
  // `\sdisabled` is the attribute (not the `disabled:` tailwind variants inside class).
  expect(html).toMatch(
    /<button[^>]*\sdisabled(=""|[\s>])[^>]*>Отметить пройденным/,
  );
});
