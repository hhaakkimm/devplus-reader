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

Копия из devplus: коммит `66762aa`.
