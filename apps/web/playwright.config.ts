import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  // 60s, not the 30s default. Several tests here legitimately drive months of
  // simulated time through the real UI -- the dormancy test clicks "+1 day"
  // 31 times, each a full render plus engine tick, and lands at 12-18s on a
  // developer machine. Against a 30s ceiling that is under 2x headroom, and it
  // duly failed once in a full-suite run while passing in isolation. A gate
  // that flakes is worse than no gate, because the habit it teaches is to
  // re-run rather than to look.
  timeout: 60_000,
  use: {
    baseURL: "http://localhost:3300",
    ...(process.env.PW_EXECUTABLE_PATH
      ? { launchOptions: { executablePath: process.env.PW_EXECUTABLE_PATH } }
      : {}),
  },
  webServer: {
    command: "pnpm run start -p 3300",
    url: "http://localhost:3300",
    reuseExistingServer: true,
    timeout: 60_000,
  },
});
