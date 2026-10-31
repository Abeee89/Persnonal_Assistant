import path from "node:path";
import { defineConfig } from "@playwright/test";

const PORT = 3210;
const DATA_DIR = path.resolve(__dirname, "test-results", "e2e-data");

export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL: `http://127.0.0.1:${String(PORT)}`,
    channel: "chrome",
    trace: "off",
    video: "off",
  },
  webServer: {
    command: `node node_modules/next/dist/bin/next start -p ${String(PORT)} -H 127.0.0.1`,
    url: `http://127.0.0.1:${String(PORT)}/`,
    timeout: 120_000,
    reuseExistingServer: false,
    env: {
      ...(process.env as Record<string, string>),
      DATA_DIR,
      HOSTNAME: "127.0.0.1",
      LOG_LEVEL: "warn",
      NEXT_TELEMETRY_DISABLED: "1",
    },
  },
});