import { test, expect } from "@playwright/test";
test.describe("suite 1", () => {
  test("test", async ({ page }) => {
    expect(true).toBeTruthy();
  });

  test.describe("suite 1.1", () => {
    test("test", async ({ page }) => {
      expect(false).toBeTruthy();
    });

    test.describe("suite 1.1.1", () => {
      test("test", async ({ page }) => {
        expect(Math.random() < 0.5).toBeTruthy();
        await new Promise((c) => setTimeout(c, 15000));
      });
    });
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
