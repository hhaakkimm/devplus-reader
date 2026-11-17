import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: { alias: { "@": path.resolve(__dirname) } },
  // e2e/ holds Playwright specs, which vitest must not pick up.
  test: { include: ["test/**/*.test.ts"] },
});
