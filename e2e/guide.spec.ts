import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.route("https://telegram.org/**", (route) =>
    route.fulfill({ contentType: "text/javascript", body: "/* stub */" }),
  );
});

const TITLES = { ru: "Как пользоваться", en: "How to use" } as const;

for (const lang of ["ru", "en"] as const) {
  test(`${lang}: the home page links to the guide, which has all sections and fits the screen`, async ({
    page,
  }) => {
    await page.goto(`${lang}/`);
    await page.getByRole("link", { name: new RegExp(TITLES[lang]) }).click();
    await expect(page).toHaveURL(new RegExp(`/${lang}/guide/$`));
    await expect(
      page.getByRole("heading", { level: 1, name: TITLES[lang] }),
    ).toBeVisible();
    await expect(page.getByRole("heading", { level: 2 })).toHaveCount(5);
    const overflow = await page.evaluate(
      () =>
        document.documentElement.scrollWidth -
        document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
  });
}

test("the guide toggles between RU and EN", async ({ page }) => {
  await page.goto("ru/guide/");
  await page.getByRole("link", { name: "EN", exact: true }).click();
  await expect(page).toHaveURL(/\/en\/guide\/$/);
  await expect(
    page.getByRole("heading", { level: 1, name: "How to use" }),
  ).toBeVisible();
});
