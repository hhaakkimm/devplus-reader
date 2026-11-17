import { readdirSync } from "node:fs";
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";

const MODULE = "Подготовка к system design";
const LESSON = "ru/lessons/sd-prep/introduction/";
const EN_LESSON = "en/lessons/sd-prep/introduction/";

// Every test gets a fresh browser context, but clear storage anyway so a test never leans on another.
// The Telegram script is stubbed (an empty file): the tests never depend on the network.
test.beforeEach(async ({ page }) => {
  await page.route("https://telegram.org/**", (route) =>
    route.fulfill({ contentType: "text/javascript", body: "/* stub */" }),
  );
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

const QUIZ = "ru/quizzes/sd-prep/core-concepts/";
const EN_QUIZ = "en/quizzes/sd-prep/core-concepts/";

// Answers the question on screen with taps (the first option, one step down for a ranking, the
// second option in every select), checks it and presses the button that moves on.
// Returns after the last one is answered.
async function playQuiz(page: Page, total: number, each?: () => Promise<void>) {
  for (let i = 1; i <= total; i++) {
    await expect(page.getByText(`Вопрос ${i} из ${total}`)).toBeVisible();
    if (await page.getByRole("list", { name: "Расставь по порядку" }).count()) {
      await page
        .getByRole("button", { name: /^Опустить:/ })
        .first()
        .click();
      await page.getByRole("button", { name: "Проверить" }).click();
    } else if (await page.getByRole("combobox").count()) {
      for (const select of await page.getByRole("combobox").all()) {
        await select.selectOption({ index: 1 });
      }
      await page.getByRole("button", { name: "Проверить" }).click();
    } else {
      await page
        .getByRole("group", { name: "Варианты ответа" })
        .getByRole("button")
        .first()
        .click();
    }
    await expect(page.getByRole("status")).toBeVisible();
    await each?.();
    await page
      .getByRole("button", { name: i < total ? "Дальше" : "Завершить" })
      .click();
  }
}

test("a quiz is played from the catalog and its best result survives a reload", async ({
  page,
}) => {
  await page.goto("ru/quizzes/");
  await expect(page.getByRole("heading", { name: "Квизы" })).toBeVisible();
  await page
    .getByRole("region", { name: MODULE })
    .getByRole("link", { name: /Core Concepts/ })
    .click();
  await expect(page).toHaveURL(new RegExp(`${QUIZ}$`));
  await expect(
    page.getByRole("heading", { level: 1, name: "Core Concepts" }),
  ).toBeVisible();

  await playQuiz(page, 15);
  const heading = page.getByRole("heading", { name: /^Результат: \d+ из 15$/ });
  await expect(heading).toBeVisible();
  const score = Number(/(\d+) из/.exec((await heading.textContent())!)![1]);

  // Retrying the mistakes starts a new pass; leaving it does not touch the saved best result.
  if (score < 15) {
    await page.getByRole("button", { name: "Повторить ошибки" }).click();
    await expect(page.getByText(/повтор ошибок/)).toBeVisible();
    await page.goto("ru/quizzes/");
  } else {
    await page.getByRole("link", { name: "← Все квизы" }).click();
  }
  await expect(page).toHaveURL(/ru\/quizzes\/$/);
  await page.reload();
  await expect(
    page
      .getByRole("region", { name: MODULE })
      .getByText(`лучший результат ${score} из 15`),
  ).toBeVisible();

  // The quiz page itself shows the best result too, also after a reload.
  await page.goto(QUIZ);
  await expect(page.getByText(`лучший результат ${score} из 15`)).toBeVisible();
  await page.reload();
  await expect(page.getByText(`лучший результат ${score} из 15`)).toBeVisible();
});

test("the quizzes catalog toggles between Russian and English", async ({
  page,
}) => {
  await page.goto("ru/quizzes/");
  await page
    .getByRole("navigation", { name: "Язык материала" })
    .getByRole("link", { name: "EN" })
    .click();
  await expect(page).toHaveURL(/en\/quizzes\/$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Quizzes");
  await page
    .getByRole("navigation", { name: "Material language" })
    .getByRole("link", { name: "RU" })
    .click();
  await expect(page).toHaveURL(/ru\/quizzes\/$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Квизы");
});

test("an English quiz has English questions and toggles to Russian and back", async ({
  page,
}) => {
  await page.goto(EN_QUIZ);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Core Concepts Quiz",
  );
  await expect(page.getByText("Question 1 of 15")).toBeVisible();
  await expect(
    page.getByRole("heading", { level: 2, name: /full-text search/ }),
  ).toBeVisible();
  await expect(page.getByText("15 questions")).toBeVisible();
  const source = page.getByRole("link", {
    name: /original on Hello Interview/,
  });
  await expect(source).toHaveAttribute("target", "_blank");
  await expect(source).toHaveAttribute("rel", "noopener noreferrer");

  await page
    .getByRole("navigation", { name: "Material language" })
    .getByRole("link", { name: "RU" })
    .click();
  await expect(page).toHaveURL(new RegExp(`${QUIZ}$`));
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Core Concepts",
  );
  await expect(page.getByText("Вопрос 1 из 15")).toBeVisible();

  await page
    .getByRole("navigation", { name: "Язык материала" })
    .getByRole("link", { name: "EN" })
    .click();
  await expect(page).toHaveURL(new RegExp(`${EN_QUIZ}$`));
  await expect(page.getByText("Question 1 of 15")).toBeVisible();
});

test("the English quiz is played with English texts", async ({ page }) => {
  await page.goto(EN_QUIZ);
  await page
    .getByRole("group", { name: "Answer options" })
    .getByRole("button")
    .first()
    .click();
  await expect(page.getByRole("status")).toContainText(/Correct!|Incorrect/);
  await expect(page.getByRole("button", { name: "Next" })).toBeVisible();
});

test("the lesson links to its quiz in both languages", async ({ page }) => {
  await page.goto("ru/lessons/sd-prep/core-concepts/");
  await expect(page.getByText("Вопросов: 15")).toBeVisible();
  await page.locator(`a[href$="/${QUIZ}"]`).click();
  await expect(page).toHaveURL(new RegExp(`${QUIZ}$`));

  await page.goto("en/lessons/sd-prep/core-concepts/");
  await expect(page.getByText("15 questions")).toBeVisible();
  await page.locator(`a[href$="/${EN_QUIZ}"]`).click();
  await expect(page).toHaveURL(new RegExp(`${EN_QUIZ}$`));
});

test("no horizontal scroll on the catalog and on every question of a quiz with ranking and matching", async ({
  page,
}) => {
  for (const url of ["ru/quizzes/", "en/quizzes/"]) {
    await page.goto(url);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    expect(await noHorizontalScroll(page)).toBe(true);
  }
  await page.goto(QUIZ);
  await expect(page.getByText("Вопрос 1 из 15")).toBeVisible();
  expect(await noHorizontalScroll(page)).toBe(true);
  // Checked state is the widest: it adds the right answer and the explanation.
  await playQuiz(page, 15, async () => {
    expect(await noHorizontalScroll(page)).toBe(true);
  });
  expect(await noHorizontalScroll(page)).toBe(true);
});

test.describe("the root page picks the language", () => {
  test("a browser in English lands on /en/", async ({ page }) => {
    await page.goto("");
    await expect(page).toHaveURL(/\/devplus-reader\/en\/$/);
  });

  test("a saved choice wins over the browser language", async ({ page }) => {
    await page.addInitScript(() => {
      if (!sessionStorage.getItem("seeded")) {
        sessionStorage.setItem("seeded", "1");
        localStorage.setItem("dpr:lang", "ru");
      }
    });
    await page.goto("");
    await expect(page).toHaveURL(/\/devplus-reader\/ru\/$/);
  });

  test("the page has language links before the redirect runs", async ({
    request,
  }) => {
    const html = await (await request.get("")).text();
    expect(html).toContain('href="/devplus-reader/ru/"');
    expect(html).toContain('href="/devplus-reader/en/"');
    expect(html).toMatch(/<noscript><a href="\/devplus-reader\/ru\/">/);
  });

  test.describe("in a Russian browser", () => {
    test.use({ locale: "ru-RU" });

    test("lands on /ru/, and a choice made with the toggle is remembered", async ({
      page,
    }) => {
      await page.goto("");
      await expect(page).toHaveURL(/\/devplus-reader\/ru\/$/);
      await page
        .getByRole("navigation", { name: "Язык материала" })
        .getByRole("link", { name: "EN" })
        .click();
      await expect(page).toHaveURL(/\/en\/$/);
      await page.goto("");
      await expect(page).toHaveURL(/\/devplus-reader\/en\/$/);
    });

    test("follows the Telegram language", async ({ page }) => {
      await fakeTelegram(page, "en-GB");
      await page.goto("");
      await expect(page).toHaveURL(/\/devplus-reader\/en\/$/);
    });
  });
});

// A stand-in for Telegram.WebApp: records the calls, keeps CloudStorage in memory. Like the real
// one it is defined by the script that telegram.org serves, i.e. after hydration, not before.
async function fakeTelegram(page: Page, lang = "en") {
  await page.addInitScript(() => {
    (window as unknown as Record<string, unknown>).__tg = {
      calls: [] as string[],
      back: "none",
      click: null,
      theme: [] as (() => void)[],
      cloud: {} as Record<string, string>,
    };
  });
  const install = (language: string) => {
    const w = window as unknown as Record<string, unknown>;
    const state = w.__tg as {
      calls: string[];
      back: string;
      click: null | (() => void);
      theme: (() => void)[];
      cloud: Record<string, string>;
    };
    const webApp = {
      initData: "query_id=fake",
      initDataUnsafe: { user: { language_code: language } },
      colorScheme: "dark",
      ready: () => state.calls.push("ready"),
      expand: () => state.calls.push("expand"),
      onEvent: (e: string, cb: () => void) => {
        if (e === "themeChanged") state.theme.push(cb);
      },
      BackButton: {
        show: () => (state.back = "shown"),
        hide: () => (state.back = "hidden"),
        onClick: (cb: () => void) => (state.click = cb),
        offClick: (cb: () => void) => {
          if (state.click === cb) state.click = null;
        },
      },
      CloudStorage: {
        getItems: (
          keys: string[],
          cb: (e: string | null, v?: Record<string, string>) => void,
        ) =>
          cb(
            null,
            Object.fromEntries(keys.map((k) => [k, state.cloud[k] ?? ""])),
          ),
        setItem: (
          k: string,
          v: string,
          cb?: (e: string | null, ok?: boolean) => void,
        ) => {
          state.cloud[k] = v;
          cb?.(null, true);
        },
      },
    };
    w.Telegram = { WebApp: webApp };
    w.__webApp = webApp;
  };
  await page.route("https://telegram.org/**", (route) =>
    route.fulfill({
      contentType: "text/javascript",
      body: `(${install})(${JSON.stringify(lang)})`,
    }),
  );
}

type Tg = {
  calls: string[];
  back: string;
  click: null | (() => void);
  theme: (() => void)[];
  cloud: Record<string, string>;
};
const tg = (page: Page) =>
  page.evaluate(() => (window as unknown as { __tg: Tg }).__tg.calls);

test.describe("the Telegram bridge", () => {
  test("ready, expand, dark theme and a BackButton that leads to the programme", async ({
    page,
  }) => {
    await fakeTelegram(page);
    await page.goto(LESSON);
    await expect.poll(() => tg(page)).toEqual(["ready", "expand"]);
    await expect(page.locator("html")).toHaveClass(/\bdark\b/);
    const back = () =>
      page.evaluate(() => (window as unknown as { __tg: Tg }).__tg.back);
    await expect.poll(back).toBe("shown");

    // Programme: hidden. Quiz catalog (header link): shown again.
    await page.getByRole("link", { name: "← К программе" }).click();
    await expect(page).toHaveURL(/ru\/$/);
    await expect.poll(back).toBe("hidden");
    await page.getByRole("link", { name: "Квизы" }).click();
    await expect(page).toHaveURL(/ru\/quizzes\/$/);
    await expect.poll(back).toBe("shown");

    // The captured onClick handler is what Telegram calls.
    await page.evaluate(() =>
      (window as unknown as { __tg: Tg }).__tg.click!(),
    );
    await expect(page).toHaveURL(/ru\/$/);
    await expect.poll(back).toBe("hidden");
    // ready and expand once, however many pages were opened.
    expect(await tg(page)).toEqual(["ready", "expand"]);
  });

  test("the theme follows themeChanged", async ({ page }) => {
    await fakeTelegram(page);
    await page.goto("ru/");
    await expect(page.locator("html")).toHaveClass(/\bdark\b/);
    await page.evaluate(() => {
      const w = window as unknown as {
        __webApp: { colorScheme: string };
        __tg: Tg;
      };
      w.__webApp.colorScheme = "light";
      w.__tg.theme.forEach((cb) => cb());
    });
    await expect(page.locator("html")).not.toHaveClass(/\bdark\b/);
  });

  test("progress reaches CloudStorage although the script loads after hydration", async ({
    page,
  }) => {
    await fakeTelegram(page);
    await page.goto(LESSON);
    await page.getByRole("button", { name: "Отметить пройденным" }).click();
    await expect
      .poll(() =>
        page.evaluate(
          () =>
            Object.keys((window as unknown as { __tg: Tg }).__tg.cloud).length,
        ),
      )
      .toBeGreaterThan(0);
    const keys = await page.evaluate(() =>
      Object.keys((window as unknown as { __tg: Tg }).__tg.cloud),
    );
    expect(keys).toContain("done-sd-prep");
  });

  test("a page works when the Telegram script is unreachable", async ({
    page,
  }) => {
    await page.route("https://telegram.org/**", (route) => route.abort());
    await page.goto(LESSON);
    const mark = page.getByRole("button", { name: "Отметить пройденным" });
    await expect(mark).toBeEnabled();
    await mark.click();
    await expect(
      page.getByRole("button", { name: "Снять отметку" }),
    ).toBeVisible();
    await expect(page.locator("html")).not.toHaveClass(/\bdark\b/);
    expect(await noHorizontalScroll(page)).toBe(true);
  });

  test("a page works when the Telegram script never answers", async ({
    page,
  }) => {
    await page.route("https://telegram.org/**", () => {
      // never fulfilled: the request hangs
    });
    await page.goto(LESSON);
    // The store waits for the script for at most 3 s.
    await expect(
      page.getByRole("button", { name: "Отметить пройденным" }),
    ).toBeEnabled({ timeout: 8000 });
  });
});

// Seeds localStorage once per tab: a reload or a later goto keeps what the page wrote since.
async function seed(page: Page, entries: Record<string, string>) {
  await page.addInitScript((e) => {
    if (!sessionStorage.getItem("seeded")) {
      sessionStorage.setItem("seeded", "1");
      for (const [k, v] of Object.entries(e)) localStorage.setItem(k, v);
    }
  }, entries);
}

const stored = (page: Page, key: string) =>
  page.evaluate((k) => localStorage.getItem(k), key);

const programmeCounter = (page: Page) =>
  page
    .getByRole("button", { name: new RegExp(MODULE) })
    .getByText(/^\d+\/\d+$/);

const DONE = "dpr:done-sd-prep";

test.describe("wide content does not scroll the page sideways", () => {
  // Real lessons: the widest table row, the longest code lines, many SVG illustrations.
  const lessons = [
    ["a wide table", "lessons/lld/problem-breakdowns-rate-limiter/", "table"],
    [
      "a seven-column table",
      "lessons/ai-coding/problem-breakdowns-maximize-unique-chars/",
      "table",
    ],
    [
      "long code lines",
      "lessons/key-technologies/time-series-databases/",
      "pre",
    ],
    ["SVG images", "lessons/ml-design/core-concepts-embeddings/", "img"],
  ] as const;
  for (const lang of ["ru", "en"]) {
    for (const [name, url, selector] of lessons) {
      test(`${lang}: ${name}`, async ({ page }) => {
        await page.goto(`${lang}/${url}`);
        await expect(
          page.locator(`article ${selector}`).first(),
        ).toBeAttached();
        expect(await noHorizontalScroll(page)).toBe(true);
      });
    }
  }

  // Every built lesson page of both languages, read from out/ (what the server serves).
  test("every lesson page of both languages", async ({ page }) => {
    const pages: string[] = [];
    for (const lang of ["ru", "en"]) {
      const root = path.resolve("out", lang, "lessons");
      for (const mod of readdirSync(root, { withFileTypes: true })) {
        if (!mod.isDirectory()) continue;
        for (const lesson of readdirSync(path.join(root, mod.name), {
          withFileTypes: true,
        })) {
          if (lesson.isDirectory())
            pages.push(`${lang}/lessons/${mod.name}/${lesson.name}/`);
        }
      }
    }
    expect(pages.length).toBeGreaterThan(250);
    test.setTimeout(pages.length * 2000 + 30_000);

    const offenders: string[] = [];
    for (const url of pages) {
      await page.goto(url);
      const [scroll, inner] = await page.evaluate(() => [
        document.documentElement.scrollWidth,
        window.innerWidth,
      ]);
      if (scroll > inner) offenders.push(`${url} (${scroll} > ${inner})`);
    }
    expect(offenders).toEqual([]);
  });
});

test.describe("hostile storage", () => {
  const garbage = [
    "not json {",
    "[1,2,3]",
    '{"introduction":"x"}',
    '{"introduction":"NaN"}',
    '{"introduction":1e999}',
    "null",
    '"a string"',
  ];
  for (const value of garbage) {
    test(`a garbage done value ${value} is ignored and then replaced by a valid one`, async ({
      page,
    }) => {
      await seed(page, { [DONE]: value });
      await page.goto("ru/");
      await expect(programmeCounter(page)).toHaveText(/^0\/\d+$/);

      await page.goto(LESSON);
      const mark = page.getByRole("button", { name: "Отметить пройденным" });
      await expect(mark).toBeEnabled();
      await mark.click();
      await expect(
        page.getByRole("button", { name: "Снять отметку" }),
      ).toBeVisible();
      await expect
        .poll(async () => {
          const raw = await stored(page, DONE);
          try {
            return (JSON.parse(raw ?? "") as Record<string, number>)
              .introduction;
          } catch {
            return undefined;
          }
        })
        .toBeGreaterThan(0);

      await page.goto("ru/");
      await expect(programmeCounter(page)).toHaveText(/^1\/\d+$/);
    });
  }

  test("a mark for a lesson that no longer exists is neither counted nor erased", async ({
    page,
  }) => {
    const stale = 1700000000;
    await seed(page, {
      [DONE]: JSON.stringify({ "no-such-lesson": stale, introduction: stale }),
    });
    await page.goto("ru/");
    // 1, not 2: only the real lesson counts.
    await expect(programmeCounter(page)).toHaveText(/^1\/\d+$/);

    await page.goto("ru/lessons/sd-prep/how-to-prepare/");
    const mark = page.getByRole("button", { name: "Отметить пройденным" });
    await expect(mark).toBeEnabled();
    await mark.click();
    await expect(
      page.getByRole("button", { name: "Снять отметку" }),
    ).toBeVisible();
    await expect
      .poll(
        async () =>
          JSON.parse((await stored(page, DONE)) ?? "{}")["how-to-prepare"],
      )
      .toBeGreaterThan(0);
    const after = JSON.parse((await stored(page, DONE))!);
    expect(after["no-such-lesson"]).toBe(stale);
    expect(after.introduction).toBe(stale);

    await page.goto("ru/");
    await expect(programmeCounter(page)).toHaveText(/^2\/\d+$/);
  });

  test("a stored result for a quiz that is gone is ignored, one for a changed quiz is shown as stored", async ({
    page,
  }) => {
    await seed(page, {
      "dpr:quiz-sd-prep-gone": "3/5",
      "dpr:quiz-sd-prep-core-concepts": "3/5",
    });
    for (const [url, text] of [
      ["ru/quizzes/", "лучший результат 3 из 5"],
      ["en/quizzes/", "best result 3 of 5"],
    ]) {
      await page.goto(url);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      // The quiz has 15 questions now; the stored 3/5 is shown as is, and only once.
      await expect(page.getByText(text)).toHaveCount(1);
      await expect(page.getByText(/gone/i)).toHaveCount(0);
      expect(await noHorizontalScroll(page)).toBe(true);
    }
    expect(await stored(page, "dpr:quiz-sd-prep-gone")).toBe("3/5");
  });
});
