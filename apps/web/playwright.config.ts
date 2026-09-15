import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  testMatch: "**/*.e2e.ts",
  timeout: 90_000,
  expect: { timeout: 15_000 },
  workers: 1,
  use: {
    baseURL: "http://127.0.0.1:4173",
    viewport: { width: 1280, height: 900 },
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    launchOptions: {
      args: [
        "--enable-unsafe-swiftshader",
        "--disable-background-timer-throttling",
        "--disable-renderer-backgrounding",
      ],
    },
  },
  webServer: [
    {
      command: "go -C ../../services/api run ./cmd/api",
      env: {
        GAME_API_ADDR: "127.0.0.1:4174",
        ALLOWED_ORIGINS: "http://127.0.0.1:4173",
      },
      url: "http://127.0.0.1:4174/health",
      timeout: 120_000,
    },
    {
      command: "pnpm exec vite --host 127.0.0.1 --port 4173 --strictPort",
      env: { VITE_PUBLIC_WS_URL: "ws://127.0.0.1:4174/ws" },
      url: "http://127.0.0.1:4173",
      timeout: 60_000,
    },
  ],
});
