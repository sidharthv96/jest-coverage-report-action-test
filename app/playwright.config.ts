import { PlaywrightTestConfig } from "@playwright/test";
import { baseURL } from "./tests/utils/constants";

const config: PlaywrightTestConfig = {
  retries: 3,
  use: {
    baseURL,
    screenshot: "only-on-failure",
    video: "on-first-retry",
    trace: "on-first-retry",
  },
  reporter: [
    ["./githubNew.ts"],
    ["json", { outputFile: "test-results/results.json" }],
    // ["junit", { outputFile: "test-results/results.xml" }],
  ],
};

export default config;
