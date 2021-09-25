import { test, expect } from "@playwright/test";
test.describe("suite 1", () => {
  test("test", async ({ page }) => {
    // Go to http://localhost:3000/
    await page.goto("http://localhost:3000/");

    // Click text=to your newSvelteKit app
    await page.click("text=to your newSvelteKit app");

    // Click text=0
    await page.click("text=0");

    // // 2× click
    // await page.click('[aria-label="Increase the counter by one"]', {
    //   clickCount: 2,
    // });

    // // Click text=13
    // await page.click("text=2");

    // Click text=About
    await page.click("text=About");
    expect(page.url()).toBe("http://localhost:3000/about");

    // Click text=About this app
    await page.click("text=About this app");
  });

  test("test 2 ", async ({ page }) => {
    // Go to http://localhost:3000/
    await page.goto("http://localhost:3000/");

    // Click text=to your newSvelteKit app
    await page.click("text=to your newSvelteKit app");

    // // Click text=0
    // await page.click("text=0");

    // // 5× click
    // await page.click('[aria-label="Increase the counter by one"]', {
    //   clickCount: 5,
    // });

    // // Click text=13
    // await page.click("text=5");

    // Click text=About
    await page.click("text=About");
    expect(page.url()).toBe("http://localhost:3000/about");
    expect(Math.random() < 0.8).toBeTruthy();
    expect(Math.random() < 0.8).toBeTruthy();
    expect(Math.random() < 0.8).toBeTruthy();
    // Click text=About this app
    await page.click("text=About this app");
  });
});
