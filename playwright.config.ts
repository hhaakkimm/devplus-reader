import { defineConfig, devices } from "@playwright/test";

// Runs against the static out/ (build first): the same files GitHub Pages serves.
export default defineConfig({
  testDir: "e2e",
  use: {
    ...devices["Desktop Chrome"],
    viewport: { width: 390, height: 844 },
    baseURL: "http://localhost:3100/devplus-reader/",
  },
  webServer: {
    command: "node scripts/serve-out.mjs",
    url: "http://localhost:3100/devplus-reader/ru/",
    reuseExistingServer: !process.env.CI,
  },
});
