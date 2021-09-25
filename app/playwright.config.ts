import { PlaywrightTestConfig } from "@playwright/test";
import { baseURL } from "./tests/utils/constants";

const config: PlaywrightTestConfig = {
  retries: 1,
  use: {
    baseURL,
    screenshot: "only-on-failure",
    video: "on-first-retry",
    trace: "on-first-retry",
  },
  webServer: {
    command: "npm run dev",
    timeout: 120 * 1000,
    port: 3000,
  },
  reporter: [
    ["./github.ts"],
    // ["json", { outputFile: "test-results/results.json" }],
    // ["junit", { outputFile: "test-results/results.xml" }],
  ],
};

export default config;
