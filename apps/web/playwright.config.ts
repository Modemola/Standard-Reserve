import { defineConfig } from "@playwright/test";

// Point PLAYWRIGHT_BASE_URL at an app you already have running to reuse it;
// otherwise the config starts one itself (this is what CI does).
const externalBaseURL = process.env.PLAYWRIGHT_BASE_URL;
const baseURL = externalBaseURL ?? "http://localhost:3300";

export default defineConfig({
  testDir: "./tests",
  timeout: 30_000,
  use: {
    baseURL,
    ...(process.env.PW_EXECUTABLE_PATH
      ? { launchOptions: { executablePath: process.env.PW_EXECUTABLE_PATH } }
      : {}),
  },
  ...(externalBaseURL
    ? {}
    : {
        webServer: {
          command: "pnpm run start -p 3300",
          url: baseURL,
          reuseExistingServer: true,
          timeout: 60_000,
        },
      }),
});
