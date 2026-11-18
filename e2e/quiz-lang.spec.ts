import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.route("https://telegram.org/**", (route) =>
    route.fulfill({ contentType: "text/javascript", body: "/* stub */" }),
  );
});

// Questions 1 and 2 of this quiz are tap-to-answer, so a first-option tap plus "Next" moves on.
test("switching the language keeps the question the reader is on", async ({
  page,
}) => {
  await page.goto("ru/quizzes/sd-prep/core-concepts/");
  for (let i = 0; i < 2; i++) {
    await page.locator('[aria-label="Варианты ответа"] button').first().click();
    await page.getByRole("button", { name: "Дальше" }).click();
  }
  await expect(page.getByText("Вопрос 3 из 15")).toBeVisible();

  await page.getByRole("link", { name: "EN", exact: true }).click();
  await expect(page).toHaveURL(/\/en\/quizzes\/sd-prep\/core-concepts\/$/);
  await expect(page.getByText("Question 3 of 15")).toBeVisible();

  await page.getByRole("link", { name: "RU", exact: true }).click();
  await expect(page.getByText("Вопрос 3 из 15")).toBeVisible();
});

// Client-side navigation keeps the module state, so this really checks the "same language" rule.
test("leaving the quiz and coming back in the same language starts over", async ({
  page,
}) => {
  await page.goto("ru/quizzes/sd-prep/core-concepts/");
  await page.locator('[aria-label="Варианты ответа"] button').first().click();
  await page.getByRole("button", { name: "Дальше" }).click();
  await expect(page.getByText("Вопрос 2 из 15")).toBeVisible();

  await page.getByRole("link", { name: "Квизы", exact: true }).click();
  await page
    .locator('a[href$="/ru/quizzes/sd-prep/core-concepts/"]')
    .first()
    .click();
  await expect(page.getByText("Вопрос 1 из 15")).toBeVisible();
});
