import { test, expect } from "@playwright/test";
test.describe("suite 2", () => {
  test("test", async ({ page }) => {
    expect(false).toBeTruthy();
  });

  test("test 2 ", async ({ page }) => {
    expect(true).toBeTruthy();
  });
});
