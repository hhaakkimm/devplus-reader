"use client";

import Script from "next/script";
import { markTelegramSettled } from "@/lib/telegram";

// A load error is not an error: the reader then runs as an ordinary website.
export function TelegramScript() {
  return (
    <Script
      src="https://telegram.org/js/telegram-web-app.js"
      strategy="afterInteractive"
      onReady={markTelegramSettled}
      onError={markTelegramSettled}
    />
  );
}
