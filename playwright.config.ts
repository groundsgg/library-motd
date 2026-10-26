import { defineConfig } from "@playwright/test";
import { chromiumLaunchOptions } from "./tools/chromium-launch.mjs";
export default defineConfig({
  testDir: "tests/browser",
  fullyParallel: true,
  workers: process.env.CI ? 2 : undefined,
  reporter:
    process.platform === "win32" && process.env.GITHUB_ACTIONS === "true"
      ? [["list"], ["./tools/windows-resource-reporter.mjs", { enabled: true }]]
      : undefined,
  timeout: 20000,
  globalSetup: "./tools/graphics-setup.mjs",
  use: {
    baseURL: "http://127.0.0.1:4173",
    viewport: { width: 1280, height: 900 },
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  webServer: {
    command: "node node_modules/vite/bin/vite.js --host 127.0.0.1 --port 4173",
    url: "http://127.0.0.1:4173/tests/browser/host.html",
    reuseExistingServer: !process.env.CI,
  },
  projects: [
    {
      name: "chromium",
      use: {
        browserName: "chromium",
        launchOptions: chromiumLaunchOptions(),
      },
    },
    { name: "firefox", use: { browserName: "firefox" } },
    { name: "webkit", use: { browserName: "webkit" } },
  ],
});
