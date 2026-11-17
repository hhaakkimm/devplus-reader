// Only the slice of Telegram.WebApp the reader uses.
export type TelegramWebApp = {
  initData: string; // empty outside Telegram
  ready(): void;
  expand(): void;
  colorScheme: "light" | "dark";
  initDataUnsafe: { user?: { language_code?: string } };
  // Bot API 6.9+; older clients throw on use (progress/storage.ts reports that as "not synced").
  CloudStorage?: {
    getItems(
      keys: string[],
      cb: (err: string | null, values?: Record<string, string>) => void,
    ): void;
    setItem(
      key: string,
      value: string,
      cb?: (err: string | null, stored?: boolean) => void,
    ): void;
  };
  BackButton: {
    show(): void;
    hide(): void;
    onClick(cb: () => void): void;
    offClick(cb: () => void): void;
  };
  onEvent(event: string, cb: () => void): void;
};

declare global {
  interface Window {
    Telegram?: { WebApp?: TelegramWebApp };
  }
}

// The script defines window.Telegram.WebApp in any browser (CloudStorage then throws), so a WebApp
// counts only with launch data, i.e. when the page really runs inside Telegram.
export function getWebApp(): TelegramWebApp | null {
  if (typeof window === "undefined") return null;
  const w = window.Telegram?.WebApp;
  return w?.initData ? w : null;
}

// The script loads after hydration (afterInteractive), so whoever needs the WebApp waits for it:
// TelegramScript calls markTelegramSettled when the script has loaded or failed.
// shortcut: a script that neither loads nor fails is given up on after 3 s and the session runs
// without Telegram (no CloudStorage), raise the timeout or create the store again if that bites.
let settle: () => void = () => {};
const settled = new Promise<void>((resolve) => (settle = resolve));
export const markTelegramSettled = () => settle();

export const whenTelegram = (): Promise<TelegramWebApp | null> =>
  getWebApp()
    ? Promise.resolve(getWebApp())
    : Promise.race([
        settled,
        new Promise<void>((resolve) => setTimeout(resolve, 3000)),
      ]).then(getWebApp);
