import { test, expect } from "@playwright/test";
test.describe("suite 1", () => {
  test("test", async ({ page }) => {
    expect(true).toBeTruthy();
  });

  test("test 2 ", async ({ page }) => {
    expect(Math.random() < 0.5).toBeTruthy();
    expect(Math.random() < 0.5).toBeTruthy();
    expect(Math.random() < 0.5).toBeTruthy();
    expect(Math.random() < 0.5).toBeTruthy();
    expect(Math.random() < 0.5).toBeTruthy();
    expect(Math.random() < 0.5).toBeTruthy();
    expect(Math.random() < 0.5).toBeTruthy();
    expect(Math.random() < 0.5).toBeTruthy();
    expect(Math.random() < 0.5).toBeTruthy();
  });
});
