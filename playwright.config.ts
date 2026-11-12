import { defineConfig, devices } from "@playwright/test";

const port = Number(process.env.E2E_PORT ?? 4173);
const authFile = "e2e/.auth/state.json";

// Expects out/ to be built (without NEXT_PUBLIC_BASE_PATH) with a throwaway login vault; see e2e/credentials.ts.
export default defineConfig({
  testDir: "e2e",
  outputDir: "test-results",
  reporter: [["list"]],
  workers: 2,
  use: { baseURL: `http://127.0.0.1:${port}`, ...devices["Desktop Chrome"], viewport: { width: 1280, height: 900 } },
  webServer: { command: "node e2e/serve.mjs", url: `http://127.0.0.1:${port}/`, reuseExistingServer: !process.env.CI },
  projects: [
    { name: "setup", testMatch: /auth\.setup\.ts/ },
    { name: "layout", testMatch: /layout\.spec\.ts/, dependencies: ["setup"], use: { storageState: authFile } },
  ],
});
