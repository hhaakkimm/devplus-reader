# devplus-reader Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Статическая читалка программы и квизов devplus (RU и EN) на GitHub Pages: Telegram Mini App и обычный сайт, без сервера и входа.

**Architecture:** Один Next.js (App Router) с `output: "export"`. Контент (`content/`) и картинки (`public/content/`) кладёт CI из публичного `hhaakkimm/devplus`. Страницы генерируются на сборке (`generateStaticParams`), MDX компилируется `next-mdx-remote/rsc` с remark-плагином, переписывающим ссылки. Прогресс живёт в клиентском слое `progress` (`localStorage` + `Telegram.WebApp.CloudStorage`, слияние «последняя запись выигрывает»).

**Tech Stack:** Next.js 16.4.6, React 19, TypeScript, Tailwind 4, shadcn/ui (копия из `devplus`), next-mdx-remote, remark-gfm, gray-matter, vitest, Playwright, pnpm, GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-11-17-devplus-reader-design.md`

## Global Constraints

- `output: "export"`, `trailingSlash: true`, `basePath: "/devplus-reader"`, `images.unoptimized: true`; все страницы через `generateStaticParams`, `dynamicParams = false`; на сервере нет `searchParams`, `cookies`, `headers`.
- Версия Next.js `16.4.6` (в `16.4.2` открыт security advisory), `eslint-config-next` той же версии. Сборка: `env -u NODE_ENV pnpm build` (с `NODE_ENV=development` падает `/_global-error`).
- Маршруты: `/ru/`, `/en/`, `/<lang>/lessons/<module>/<lesson>/`, `/<lang>/quizzes/`, `/<lang>/quizzes/<module>/<quiz>/`; корень `/` выбирает язык на клиенте: сохранённый выбор, затем `Telegram.WebApp.initDataUnsafe.user.language_code`, затем `navigator.language`, иначе `ru`.
- Исключено из контента: модуль `00-start`, подпапки `tasks/` и `simulator/` (одна константа `EXCLUDED`). Модули без уроков не показываются. `/en/...` генерируется только там, где есть английская версия.
- Контент: модули `NN-*`, уроки `NN-slug.mdx` (RU) и `NN-slug.en.mdx` (EN), `_module.json` с `sections`, квизы `quizzes/<slug>.json` и `<slug>.en.json`, связь квиза с уроком через `quiz:` во frontmatter. Ошибка в контенте валит сборку с именем файла.
- Папка `content/` не в репо (`.gitignore`); `CONTENT_DIR` по умолчанию `../devplus/content`. `public/content/` тоже в `.gitignore` (его кладёт CI или `pnpm sync-assets` локально).
- Remark-плагин: `/content/<...>` → `<basePath>/content/<...>`; `/lessons/<m>/<l>` (с хвостом `?lang=en` и/или `#якорь`) → `<basePath>/<lang страницы>/lessons/<m>/<l>/` (хвост `?lang=...` отбрасывается, якорь сохраняется); внешние ссылки (`http`, `https`, `mailto`, `tel`) и якоря `#...` не трогаются; EN-ссылка на урок без `.en.mdx` ведёт на RU-страницу и печатает предупреждение с именем файла.
- Ключи прогресса: `done-<module>` = JSON-объект `{"<lesson-slug>": <t>}` (`t` unix-секунды, положительное «пройден», отрицательное «отметка снята», побеждает больший `|t|`), `quiz-<module>-<quiz>` = `"<score>/<total>"` (побеждает большая доля, только растёт), `lang`. Ключ `CloudStorage`: 1–128 символов `[A-Za-z0-9_-]`, значение до 4096 символов. Неизвестные slug не показываются и не удаляются; результат квиза хранится и показывается как есть («3 из 5»).
- `CloudStorage` недоступен или падает: интерфейс работает на `localStorage`, тихая пометка «не синхронизировано».
- `telegram-web-app.js` грузится через `next/script`; ошибка загрузки значит «обычный сайт». Внутри Telegram: `ready()`, `expand()`, `BackButton` (на уроке и квизе ведёт к программе), тема по `colorScheme`, safe areas.
- Копия из `devplus/apps/web` помечается в `README` коммитом `devplus`, с которого сделана (на момент плана `66762aa`). Все вызовы API, `session.ts`, `browser-api`, `progress-toggle` из копии убираются.
- Тексты интерфейса RU и EN в одном словаре (`lib/i18n.ts`); лента последних попыток, симулятор, Code Review, Лаборатория, вход, `startapp` не делаем.
- Секреты не нужны; файлы `.env` не читать. Отвечать пользователю по-русски на «ты», термины по-английски.

## Review Focus

- Урок без `.en.mdx` или квиз без `.en.json` (в EN-интерфейсе): нет битой страницы и нет переключателя, ссылка ведёт на RU, сборка не падает.
- `localStorage` или `CloudStorage` недоступны, бросают или отдают мусор (не JSON, не тот тип): интерфейс работает, мусорная запись игнорируется, а не валит страницу.
- Slug урока или квиза переименован/удалён после сохранения прогресса: запись не показывается и не затирается, счётчик модуля не растёт.
- Ссылка в MDX с якорем, с `?lang=en`, с внешним URL, относительная, пустая: каждая переписывается или остаётся по правилам плагина, без двойного `basePath`.
- Горизонтальная прокрутка на 390×844 в уроке с широкой таблицей, длинным кодом и SVG-картинкой.
- Квиз полностью проходится с телефона: ranking и matching работают касанием (кнопки ↑ ↓ и `select`), результат переживает перезагрузку.
- Два устройства: отметка снята на одном, поставлена на другом — побеждает более поздняя; часы устройств расходятся (берём `|t|` как есть, ничего не «чиним»).

## File Structure

```
package.json, pnpm-lock.yaml, next.config.ts, tsconfig.json, postcss.config.mjs
vitest.config.ts, playwright.config.ts, eslint.config.mjs, .prettierrc, .gitignore, README.md
components.json                        # shadcn
.github/workflows/deploy.yml
public/.nojekyll
scripts/sync-assets.sh                 # локально: копирует ../devplus/apps/web/public/content в public/content
scripts/smoke-out.mjs
app/layout.tsx, app/globals.css, app/page.tsx (выбор языка на клиенте), app/not-found.tsx
app/[lang]/layout.tsx                  # <html lang>, Telegram script, провайдер прогресса, шапка
app/[lang]/page.tsx                    # программа
app/[lang]/lessons/[module]/[lesson]/page.tsx
app/[lang]/quizzes/page.tsx
app/[lang]/quizzes/[module]/[quiz]/page.tsx
lib/content.ts, quizzes.ts, quiz-state.ts, toc.ts   # копия + правки (Task 2)
lib/links.ts                           # remark-плагин (Task 3)
lib/i18n.ts                            # Lang, словарь, t()
lib/progress/{merge,storage,store}.ts  # Task 4
lib/telegram.ts                        # обёртка window.Telegram.WebApp
lib/lang.ts                            # pickLang (Task 6)
components/ui/*                        # копия из devplus
components/{curriculum-nav,lesson-toc,scroll-to-active,quiz,lang-toggle,progress-toggle,telegram-bridge,sync-badge,progress-provider,root-redirect}.tsx
test/*.test.ts, test/fixtures/content/ # vitest
e2e/reader.spec.ts
```

---

### Task 1: Каркас: Next static export, Tailwind, shadcn, vitest

**Files:**
- Create: все конфиги и `app/layout.tsx`, `app/globals.css`, `app/page.tsx` (заглушка), `components/ui/*` (копия из `devplus/apps/web/components/ui`: `accordion, alert, badge, button, card, native-select, progress, separator, table`), `lib/utils.ts` (`cn`), `components.json`, `.gitignore`, `public/.nojekyll`, `scripts/sync-assets.sh`, `README.md`
- Test: `test/smoke.test.ts`

**Interfaces:**
- Produces: `cn(...inputs): string` из `lib/utils.ts`; алиас `@/*` → корень; скрипты `dev`, `build`, `test` (`vitest run`), `lint` (`eslint` + `tsc --noEmit`), `sync-assets`; `.gitignore` содержит `content/`, `public/content/`, `out/`, `.next/`, `node_modules/`.

- [ ] **Step 1: Write the failing test** `test/smoke.test.ts`: `import { cn } from "@/lib/utils"`; `expect(cn("a", false, "b")).toBe("a b")`.
- [ ] **Step 2: Run it** `pnpm vitest run` в пустом репо: FAIL (нет конфигов).
- [ ] **Step 3: Scaffold.** `pnpm init`; зависимости как в `devplus/apps/web/package.json` без `@devplus/api-client`, `@xyflow/react`, `shiki`, но с `next@16.4.6`, `eslint-config-next@16.4.6`, `next-mdx-remote`, `remark-gfm`, `gray-matter`, `@mdx-js/mdx`, `@tailwindcss/typography`, `@tailwindcss/turbopack`, `tailwindcss@4`, `vitest`, `@playwright/test`, `prettier`. `next.config.ts`: `output: "export"`, `trailingSlash: true`, `basePath: "/devplus-reader"`, `images: { unoptimized: true }`, `turbopack.rules` для `*.css` как в `devplus/apps/web/next.config.ts` (без `rewrites`, `standalone`, `outputFileTracingRoot`, `transpilePackages`). `app/globals.css` и шрифты в `app/layout.tsx` копируются из `devplus` (Geist, Geist Mono, Source Serif 4; `html lang` перекрывается в `[lang]/layout`). `vitest.config.ts` как в `devplus` (`include: ["test/**/*.test.ts"]`, alias `@`). `scripts/sync-assets.sh`: `rm -rf public/content && cp -R ${DEVPLUS:-../devplus}/apps/web/public/content public/content`. `README.md`: что это, команды, строка «Копия из devplus: коммит `66762aa`».
- [ ] **Step 4: Run** `pnpm vitest run` PASS; `env -u NODE_ENV pnpm build` создаёт `out/index.html` (контент ещё не нужен: `app/page.tsx` заглушка).
- [ ] **Step 5: Commit** `chore: scaffold the static reader app`

---

### Task 2: Загрузчик контента и квизов (копия + RU/EN)

**Files:**
- Create: `lib/content.ts`, `lib/quizzes.ts`, `lib/quiz-state.ts`, `lib/toc.ts`, `lib/i18n.ts` (только тип `Lang = "ru" | "en"` и `LANGS`; словарь в Task 5)
- Test: `test/content.test.ts`, `test/quizzes.test.ts`, `test/toc.test.ts`; фикстура `test/fixtures/content/` (модули `00-start`, `20-mod` с `_module.json` и секциями, уроки `01-a.mdx`, `01-a.en.mdx`, `02-b.mdx` без EN, `03-c.mdx` с `quiz: q1`, `tasks/`, `simulator/`, `quizzes/q1.json`, `q1.en.json`, `q2.json` без EN; пустой модуль `30-empty`)

**Interfaces:**
- Consumes: `devplus/apps/web/lib/{content,quizzes,quiz-state,toc}.ts` (копируются, сохраняя `list`, `slugOf`, `parse`, `parseSections`, `groupLessons`, `parseQuiz`, `LEVELS`, `initialAnswer`, `canCheck`, `isCorrect`, `headingIds`, `TocItem`).
- Produces:
  - `EXCLUDED = { modules: ["00-start"], folders: ["tasks", "simulator"] } as const` в `lib/content.ts`; `CONTENT_DIR = process.env.CONTENT_DIR ?? path.resolve(process.cwd(), "../devplus/content")`.
  - `type LessonMeta = { slug; moduleSlug; lessonSlug; title; summary; order; quiz?; en?: { title: string; summary: string } }` (`en` присутствует, только если есть `.en.mdx`).
  - `type Lesson = LessonMeta & { source: string; enSource?: string }`.
  - `loadCurriculum(dir = CONTENT_DIR): Promise<Module[]>` — без `00-start`, без модулей без уроков; `Module` как в `devplus`.
  - `loadLesson(moduleSlug, lessonSlug, dir?): Promise<Lesson | null>` — параметр `folder` не нужен.
  - `loadQuizCatalog(dir?): Promise<QuizModule[]>` где `QuizMeta = { slug; moduleSlug; quizSlug; title; count; en?: { title: string } }`.
  - `loadQuiz(moduleSlug, quizSlug, dir?, lang?: "ru" | "en"): Promise<(Quiz & { hasEn: boolean }) | null>`; при `lang: "en"` без EN-файла возвращает RU-квиз с `hasEn: false`.
  - Решение (ruling): названия модулей и разделов остаются русскими в EN-интерфейсе (`_module.json` не имеет EN-полей). `// shortcut: titles of modules and sections are Russian-only, add optional title_en to _module.json in devplus when needed`.

- [ ] **Step 1: Write failing tests** в `test/content.test.ts` на фикстуре: `loadCurriculum` не содержит `00-start` и `30-empty`; `tasks/` и `simulator/` не попадают в уроки; `01-a` имеет `en.title`, `02-b` нет `en`; битый frontmatter (`title` не строка) бросает ошибку с путём файла (`rejects.toThrow(/01-bad\.mdx/)` на отдельной фикстуре в temp-каталоге); `loadLesson("20-mod","02-b")` даёт `enSource === undefined`; `loadLesson("..","x")` → `null`. В `test/quizzes.test.ts`: каталог содержит `q1` с `en.title` и `q2` без; `loadQuiz(..., "q1", dir, "en")` возвращает EN-вопросы и `hasEn: true`; `q2` с `lang: "en"` → RU и `hasEn: false`; EN-квиз с другим числом вопросов бросает ошибку; невалидный квиз (`answer` вне 0..3) бросает с путём. В `test/toc.test.ts`: `headingIds` даёт разные id для повторных заголовков (`-2`) и сохраняет кириллицу.
- [ ] **Step 2: Run** `pnpm vitest run test/content.test.ts test/quizzes.test.ts test/toc.test.ts` — FAIL.
- [ ] **Step 3: Implement** копированием из `devplus` и правками выше: исключения применяются в `list`-вызовах `loadCurriculum`/`loadQuizCatalog`/`loadLesson`; EN-метаданные читаются из `NN-slug.en.mdx` (`title` обязателен, `summary` у EN может отсутствовать, тогда `""`); убрать параметр `folder`.
- [ ] **Step 4: Run** те же тесты — PASS; `pnpm tsc --noEmit` без ошибок.
- [ ] **Step 5: Commit** `feat: content and quiz loaders with RU/EN twins and exclusions`

---

### Task 3: Remark-плагин переписывания ссылок

**Files:**
- Create: `lib/links.ts`
- Test: `test/links.test.ts`

**Interfaces:**
- Consumes: `Lang` из `lib/i18n.ts`.
- Produces: `BASE_PATH = "/devplus-reader"` (используется и в `next.config.ts`); `rewriteUrl(url: string, o: { lang: Lang; basePath: string; hasEn: (lessonSlug: string) => boolean; file: string }): string` (`lessonSlug` в формате `module/lesson`); `rewriteLinks(o) => () => (tree) => void` — remark-плагин поверх `rewriteUrl`.

- [ ] **Step 1: Write failing tests** `test/links.test.ts` на `rewriteUrl` (`lang: "ru"`, `basePath: "/devplus-reader"`): `/content/a/b.svg` → `/devplus-reader/content/a/b.svg`; `/lessons/21-core-concepts/02-caching` → `/devplus-reader/ru/lessons/21-core-concepts/02-caching/`; `/lessons/m/l?lang=en#x` → `/devplus-reader/ru/lessons/m/l/#x`; `lang: "en"` с `hasEn` = false → путь с `ru` и `console.warn`, в сообщении есть `file`; `https://x.y`, `mailto:a@b`, `#anchor`, `relative/path`, пустая строка остаются как есть. Тест на дерево: узлы `image` и `link` обработаны, `inlineCode` с `/content/x` не тронут.
- [ ] **Step 2: Run** `pnpm vitest run test/links.test.ts` — FAIL.
- [ ] **Step 3: Implement** `rewriteUrl` на регулярках `^/content/` и `^/lessons/([a-z0-9-]+)/([a-z0-9-]+)(?:\?[^#]*)?(#.*)?$`; плагин обходит `image` и `link` (поле `url`) без новых зависимостей (рекурсивный обход, как `headingIds` в `lib/toc.ts`).
- [ ] **Step 4: Run** — PASS.
- [ ] **Step 5: Commit** `feat: remark plugin rewriting /content and /lessons links`

---

### Task 4: Слой прогресса (слияние, два хранилища)

**Files:**
- Create: `lib/progress/merge.ts`, `lib/progress/storage.ts`, `lib/progress/store.ts`, `lib/telegram.ts`
- Test: `test/progress-merge.test.ts`, `test/progress-store.test.ts`

**Interfaces:**
- Produces:
  - `merge.ts` (чистые функции): `type Done = Record<string, number>`; `mergeDone(a: Done, b: Done): Done` (по каждому slug побеждает больший `|t|`; при равных `|t|` побеждает положительный); `isDone(d: Done, slug: string): boolean` (`d[slug] > 0`); `mark(d: Done, slug: string, done: boolean, now: number): Done` (`now` unix-секунды; пишет `+t` или `-t`, где `t = Math.max(now, |old| + 1)`); `mergeQuiz(a: string | undefined, b: string | undefined): string | undefined` (больше доля `score/total`; невалидные значения игнорируются; при равенстве берётся первое); `parseScore(v: string): { score: number; total: number } | null`; `splitDone(module: string, d: Done): Record<string, string>` и `joinDone(module: string, entries: Record<string, string>): Done` — разбиение `done-<module>` на ключи `done-<module>`, `done-<module>-2`, … по лимиту `MAX_VALUE = 4096` символов JSON.
  - `storage.ts`: `interface KV { get(keys: string[]): Promise<Record<string, string>>; set(key: string, value: string): Promise<void> }`; `localKV: KV` (оборачивает `localStorage` в try/catch, ключи с префиксом `dpr:`); `cloudKV(tg): KV | null` (на `Telegram.WebApp.CloudStorage.getItems/setItem`, `null`, если API нет).
  - `store.ts`: `createStore(local: KV, cloud: KV | null, now: () => number): ProgressStore` с `ProgressStore = { load(modules: string[], quizKeys: string[]): Promise<Snapshot>; markLesson(module, slug, done): Promise<void>; saveQuiz(module, quiz, score, total): Promise<void>; setLang(l): Promise<void>; subscribe(fn): () => void; getSnapshot(): Snapshot; synced(): boolean }`; `Snapshot = { done: Record<string, Done>; quizzes: Record<string, string>; lang?: string }`.
  - `lib/telegram.ts`: `getWebApp(): TelegramWebApp | null` (читает `window.Telegram?.WebApp`; тип описывает только используемые поля: `ready, expand, colorScheme, initDataUnsafe.user.language_code, CloudStorage, BackButton{show,hide,onClick,offClick}, onEvent`).

- [ ] **Step 1: Write failing tests.** `progress-merge.test.ts`: снятие отметки на устройстве B (позже) побеждает отметку на A; отметка на A (позже) побеждает снятие на B; неизвестный slug в `b` сохраняется в результате `mergeDone`; `mark` при `now` ≤ старого `|t|` увеличивает `|t|`; `mergeQuiz("3/5","4/5") === "4/5"`, `mergeQuiz("3/5","мусор") === "3/5"`, `mergeQuiz("3/5","1/1") === "1/1"`, `parseScore("a/b") === null`, `parseScore("5/0") === null`; `splitDone`/`joinDone` для объекта в 100 slug по 40 символов даёт значения длиной ≤ 4096 и `joinDone(splitDone(x))` равно `x`. `progress-store.test.ts` с in-memory `KV`: `load` объединяет local и cloud (последняя запись выигрывает) и пишет результат обратно в оба; `cloud.set` бросает — `synced()` становится `false`, `markLesson` всё равно меняет снимок и `local`; `cloud === null` — `synced()` остаётся `true`; мусор в `local` (не JSON) игнорируется без исключения; `saveQuiz` не уменьшает сохранённый результат (4/5 после 5/5 не пишется); `subscribe` вызывается при изменении.
- [ ] **Step 2: Run** `pnpm vitest run test/progress-merge.test.ts test/progress-store.test.ts` — FAIL.
- [ ] **Step 3: Implement** по интерфейсам. `cloudKV` оборачивает колбэчные методы `CloudStorage` в `Promise` (ошибка колбэка — `reject`).
- [ ] **Step 4: Run** — PASS.
- [ ] **Step 5: Commit** `feat: progress layer with last-write-wins merge over localStorage and CloudStorage`

---

### Task 5: Интерфейс: layout, программа, урок, переключатель языка

**Files:**
- Create: `app/[lang]/layout.tsx`, `app/[lang]/page.tsx`, `app/[lang]/lessons/[module]/[lesson]/page.tsx`, `components/{curriculum-nav,lesson-toc,scroll-to-active,lang-toggle,progress-toggle,sync-badge,progress-provider}.tsx`; расширить `lib/i18n.ts` словарём; `app/not-found.tsx`
- Test: `test/i18n.test.ts`, `e2e/reader.spec.ts` (создаётся здесь, дополняется в Task 6 и 8), `playwright.config.ts`

**Interfaces:**
- Consumes: Task 2 (`loadCurriculum`, `loadLesson`, `groupLessons`, `headingIds`), Task 3 (`rewriteLinks`, `BASE_PATH`), Task 4 (`createStore`, `localKV`, `cloudKV`, `getWebApp`).
- Produces: `lib/i18n.ts`: `t(lang: Lang, key: Key): string` (ключи: заголовки, «Содержание», «Отметить пройденным», «Проверь себя», «← К программе», «Предыдущий», «Следующий», подписи квиза, «не синхронизировано» и т. д.; полнота обоих языков проверяется тестом); `ProgressProvider` (клиентский: создаёт store, вызывает `load`, отдаёт `useProgress()` с `doneSet(moduleSlug)`, `isDone(slug)`, `mark(slug, bool)`, `quizResult(slug)`, `saveQuiz(module, quiz, score, total)`, `setLang(l)`, `synced`); `LangToggle({ lang, path })`, где `path` — путь без языкового префикса (`/lessons/m/l/`), ссылка на другой язык строится как `/<other>${path}`; показывается только при наличии другой версии.
- Страницы: `generateStaticParams` на `[lang]` — `ru` и `en`; на уроке — все пары `lang × lesson`, где для `en` урок имеет `en`; `export const dynamicParams = false`. Урок компилируется `compileMDX` с `remarkPlugins: [remarkGfm, headingIds(toc), rewriteLinks({...})]`, `hasEn` строится по `loadCurriculum`. `<html lang>` задаёт `[lang]/layout`.
- `playwright.config.ts`: viewport 390×844, `webServer` отдаёт статический `out/` под `/devplus-reader/` (например `pnpm dlx serve`-подобный статический сервер без новой зависимости: маленький `scripts/serve-out.mjs` на `node:http`, порт 3100), `baseURL` `http://localhost:3100/devplus-reader/`.

- [ ] **Step 1: Write failing tests** `test/i18n.test.ts`: наборы ключей `ru` и `en` совпадают, значения непустые. Первая версия `e2e/reader.spec.ts`: `/devplus-reader/ru/` показывает модули и счётчик `0/N`; урок открывается; «Отметить пройденным» меняет счётчик в навигации и переживает `page.reload()`; на `ru` нет горизонтальной прокрутки (`document.documentElement.scrollWidth <= innerWidth`).
- [ ] **Step 2: Run** `pnpm vitest run test/i18n.test.ts` — FAIL; e2e пока не запускать.
- [ ] **Step 3: Implement.** Из `devplus` копируются и упрощаются: `curriculum-nav.tsx` (ссылки `/<lang>/lessons/...`, `done` берётся из `useProgress`, клиентский компонент), `lesson-toc.tsx`, `scroll-to-active.tsx`, страница урока (структура как в `devplus`: сворачиваемое «Содержание» на узком экране, `Card` «Проверь себя» со ссылкой на квиз; «лучший результат» рисует клиентский компонент из `useProgress`). `ProgressToggle` вызывает `mark`, без API. `SyncBadge` показывает `t(lang, "notSynced")`, если `!synced`. Названия модулей и разделов берутся из `_module.json` как есть (русские, см. ruling Task 2).
- [ ] **Step 4: Run** `pnpm vitest run`; `pnpm sync-assets`; `env -u NODE_ENV pnpm build` создаёт `out/ru/index.html` и `out/ru/lessons/20-sd-prep/01-introduction/index.html`; затем `pnpm playwright test e2e/reader.spec.ts` PASS.
- [ ] **Step 5: Commit** `feat: programme and lesson pages in RU and EN with progress`

---

### Task 6: Квизы, выбор языка на корне, Telegram-мост

**Files:**
- Create: `app/[lang]/quizzes/page.tsx`, `app/[lang]/quizzes/[module]/[quiz]/page.tsx`, `components/{quiz,telegram-bridge,root-redirect}.tsx`, `lib/lang.ts`; изменить `app/page.tsx`, `app/[lang]/layout.tsx`
- Test: `test/lang.test.ts`; дополнить `e2e/reader.spec.ts`

**Interfaces:**
- Consumes: `QuizRunner` копируется из `devplus/apps/web/components/quiz.tsx`; Task 4 (`useProgress`, `getWebApp`); `lib/quiz-state.ts`.
- Produces:
  - `lib/lang.ts`: `pickLang(i: { stored?: string | null; tg?: string | null; nav?: readonly string[] }): Lang` — сохранённое `ru|en`, затем `tg` (`ru|en` по префиксу до `-`), затем первый подходящий из `nav`, иначе `"ru"`; невалидные значения пропускаются.
  - `QuizRunner({ quiz, lang }: { quiz: Quiz; lang: Lang })`: текстовые константы (`Верно/Неверно`, `Результат: X из Y`, …) берутся из словаря `t`; вместо `browserApi.PUT` вызывает `useProgress().saveQuiz(quiz.moduleSlug, quiz.quizSlug, score, total)` (только полный проход, как в `devplus`); блок «Результат не сохранился» и `Alert` ошибки удаляются; ссылка «← Все квизы» ведёт на `/<lang>/quizzes/`.
  - `TelegramBridge` (клиентский, в `[lang]/layout`): `ready()` и `expand()` при наличии WebApp; класс `dark` по `colorScheme`; safe areas: корневой контейнер `[lang]/layout` получает `padding` из `env(safe-area-inset-*)` (и `viewport-fit=cover` в `metadata.viewport`); `BackButton`: на `/<lang>/lessons/...` и `/<lang>/quizzes/...` показывается и ведёт на `/<lang>/` (`router.push`), на остальных скрыта; снимает обработчик при размонтировании. Скрипт `https://telegram.org/js/telegram-web-app.js` через `next/script` (`strategy="afterInteractive"`, ошибка загрузки игнорируется).
  - `app/page.tsx` рендерит `RootRedirect` (клиентский: `pickLang` → `router.replace("/<lang>/")`, плюс `<noscript>` и ссылка на `/ru/`).
  - Каталог квизов: модули и квизы (название по языку, `count`, лучший результат из `useProgress`); страница квиза: `generateStaticParams` — `lang × quiz`, `en` только если `hasEn`; рядом `LangToggle`, `source` как ссылка.

- [ ] **Step 1: Write failing tests** `test/lang.test.ts`: `pickLang({ stored: "en" })`=`"en"`; `{ stored: "de", tg: "en-US" }`=`"en"`; `{ tg: "ru" }`=`"ru"`; `{ nav: ["de-DE","en-GB"] }`=`"en"`; `{}`=`"ru"`. Дополнить `e2e/reader.spec.ts`: каталог `/ru/quizzes/` → квиз → ответы по касанию → итог «Результат: X из Y» → после `reload` каталог показывает лучший результат; EN-страница квиза с английскими вопросами; на 390 px нет горизонтальной прокрутки на квизе с `matching` и `ranking`; открытие корня с `locale: "en-US"` приводит на `/devplus-reader/en/`, а с сохранённым `dpr:lang=ru` на `/ru/`.
- [ ] **Step 2: Run** `pnpm vitest run test/lang.test.ts` — FAIL.
- [ ] **Step 3: Implement** по интерфейсам. Выбор языка сохраняется через `setLang` при нажатии переключателя.
- [ ] **Step 4: Run** `pnpm vitest run` PASS; `pnpm build` создаёт `out/en/quizzes/20-sd-prep/core-concepts/index.html`; `pnpm playwright test` PASS.
- [ ] **Step 5: Commit** `feat: quizzes, root language pick and Telegram bridge`

---

### Task 7: Деплой: GitHub Actions и smoke

**Files:**
- Create: `.github/workflows/deploy.yml`, `scripts/smoke-out.mjs`
- Modify: `README.md` (раздел «Деплой», шаг владельца)

**Interfaces:**
- Consumes: сборка `out/` из Task 5–6.
- Produces: workflow `deploy.yml`: триггеры `push` (ветка `main`), `schedule` (раз в сутки), `workflow_dispatch`; `permissions: contents: read, pages: write, id-token: write`; шаги: checkout этого репо; checkout `hhaakkimm/devplus` (`ref: main`, `path: devplus`, `sparse-checkout: content, apps/web/public/content`); `cp -R devplus/apps/web/public/content public/content`; `CONTENT_DIR=$GITHUB_WORKSPACE/devplus/content`; `pnpm install --frozen-lockfile`; `pnpm test`; `pnpm build`; `node scripts/smoke-out.mjs`; `actions/upload-pages-artifact` (`path: out`); `actions/deploy-pages` в отдельном job с `environment: github-pages`. Версии actions закрепить на мажор (`actions/checkout@v4`, `pnpm/action-setup@v4`, `actions/setup-node@v4`, `actions/upload-pages-artifact@v3`, `actions/deploy-pages@v4`); `concurrency: { group: pages, cancel-in-progress: false }`. Комментарий `shortcut:` про `schedule` из спеки (60 дней без активности, `repository_dispatch` при необходимости).
- `scripts/smoke-out.mjs`: exit 1 с перечнем недостающего, если нет `out/ru/index.html`, `out/en/index.html`, `out/ru/quizzes/index.html`, хотя бы одного урока и квиза на каждом языке (`out/<lang>/lessons/*/*/index.html`, `out/<lang>/quizzes/*/*/index.html`), `out/.nojekyll`, `out/content/` (картинки); при успехе печатает число страниц и размер `out/`.

- [ ] **Step 1: Write the check first:** `scripts/smoke-out.mjs`.
- [ ] **Step 2: Run** `rm -rf out && node scripts/smoke-out.mjs` — exit 1 (ожидаемо).
- [ ] **Step 3: Implement** workflow и README (раздел деплоя: «Settings → Pages → Source: GitHub Actions», адрес `https://hhaakkimm.github.io/devplus-reader/`).
- [ ] **Step 4: Run** локально: `pnpm sync-assets && env -u NODE_ENV pnpm build && node scripts/smoke-out.mjs` — exit 0; в отчёт вывести размер `out/` и время сборки (спека: около 41 МБ, около 280 страниц). YAML проверить `python3 -c "import sys,yaml; yaml.safe_load(open(sys.argv[1]))" .github/workflows/deploy.yml`.
- [ ] **Step 5: Commit** `ci: build and deploy the reader to GitHub Pages`

---

### Task 8: Финальная проверка и дорожная карта

**Files:**
- Modify: `e2e/reader.spec.ts`, `docs/superpowers/specs/2026-11-17-devplus-reader-design.md` (статус «реализована» после успешного деплоя), `README.md`; в `devplus`: `docs/roadmap.html` (пункт про читалку со ссылкой на репо)

**Interfaces:**
- Consumes: всё выше.
- Produces: зелёные проверки; запись в roadmap.

- [ ] **Step 1: Add the remaining Review Focus e2e checks** в `e2e/reader.spec.ts`: урок с широкой таблицей и SVG на 390 px без горизонтальной прокрутки; мусор в `localStorage` (`dpr:done-20-sd-prep` не JSON) не ломает программу (счётчик `0/N`); сохранённая отметка для несуществующего slug не меняет счётчик.
- [ ] **Step 2: Run all checks** `pnpm lint && pnpm test && env -u NODE_ENV pnpm build && node scripts/smoke-out.mjs && pnpm playwright test` — всё зелёное.
- [ ] **Step 3: Push** в `origin/main` только после явного разрешения пользователя (CI собирает и выкладывает; нужен шаг владельца «Pages → GitHub Actions»); после деплоя `curl -I https://hhaakkimm.github.io/devplus-reader/ru/` не отдаёт `x-frame-options` (риск из спеки).
- [ ] **Step 4: Update docs.** Статус спеки «реализована <дата>»; в `devplus/docs/roadmap.html` пункт «devplus-reader» со ссылками на репо и сайт; перепубликовать артефакт https://claude.ai/artifact/5qazb7JVKno2HnYRD7f4Ma.
- [ ] **Step 5: Commit** `docs: mark devplus-reader implemented` (в каждом репо отдельным коммитом).

Ручные проверки на телефоне после деплоя (не автоматизируются): `CloudStorage` синхронизирует два устройства, `BackButton`, safe areas, поведение в Telegram Web (фрейм).
