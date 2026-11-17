// Only the slice of Telegram.WebApp the reader uses.
export type TelegramWebApp = {
  ready(): void;
  expand(): void;
  colorScheme: "light" | "dark";
  initDataUnsafe: { user?: { language_code?: string } };
  // Absent before Bot API 6.9.
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

export function getWebApp(): TelegramWebApp | null {
  if (typeof window === "undefined") return null;
  return window.Telegram?.WebApp ?? null;
}
