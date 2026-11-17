# devplus-reader

Статическая читалка программы и квизов devplus (RU и EN) на GitHub Pages под `/devplus-reader`: Telegram Mini App и обычный сайт, без сервера и входа.

Контент (`content/`) и картинки (`public/content/`) не в репо: `CONTENT_DIR` по умолчанию `../devplus/content`, картинки кладёт CI или `pnpm sync-assets`.

## Команды

```
pnpm dev           # dev-сервер
env -u NODE_ENV pnpm build   # статическая сборка в out/
pnpm test          # vitest
pnpm lint          # eslint + tsc --noEmit
pnpm e2e           # Playwright против out/ на :3100 (сначала сборка)
pnpm sync-assets   # копирует ../devplus/apps/web/public/content в public/content
```

## Деплой

Workflow `.github/workflows/deploy.yml` запускается на push в `main`, раз в сутки (`schedule`, 04:17 UTC) и вручную. Job `build`: checkout этого репо и публичного `hhaakkimm/devplus` (sparse: `content/` и `apps/web/public/content/`), копия картинок в `public/content/`, `pnpm install --frozen-lockfile`, `pnpm test`, `pnpm build` с `CONTENT_DIR` на `content/` из devplus, `node scripts/smoke-out.mjs`, загрузка `out/` как артефакта Pages. Job `deploy` публикует артефакт в environment `github-pages` (деплой разрешён только из ветки `main`). Lint, format и e2e в CI не входят, это локальные проверки.

Адрес сайта: `https://hhaakkimm.github.io/devplus-reader/`.

Один ручной шаг владельца: Settings → Pages → Source: GitHub Actions.

Ручной запуск (например, чтобы подтянуть свежий контент): Actions → deploy → Run workflow. GitHub отключает scheduled workflows в публичном репо после 60 дней без активности (по моим данным, проверить), тогда достаточно ручного запуска.

Локальная проверка сборки:

```
pnpm sync-assets && env -u NODE_ENV pnpm build && node scripts/smoke-out.mjs
```

Проверки после первого деплоя:

- `curl -I https://hhaakkimm.github.io/devplus-reader/ru/` не должен показывать `x-frame-options` (и строгий `frame-ancestors`): иначе страница не откроется во фрейме Telegram Web. Заодно открыть в Telegram Web.
- Посмотреть время сборки и размер артефакта в логе job `build` (у Pages лимит около 1 ГБ, по моим данным).
- Права на контент не проверены: в `content/` лежат переводы и копии материалов Hello Interview, сайт будет публичным. Проверить лицензию до того, как делиться ссылкой за пределами команды (решение владельца).
- `CloudStorage`, `BackButton`, safe areas проверяются только в настоящем Telegram на телефоне.

Копия из devplus: коммит `66762aa`.
