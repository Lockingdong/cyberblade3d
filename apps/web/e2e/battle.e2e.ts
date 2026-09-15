import { test, expect, type Page } from "@playwright/test";

async function menu(page: Page) {
  await page.goto("/?debug");
  await expect(page.locator(".intro-screen")).toHaveCount(0);
  await page.getByLabel("畫質", { exact: true }).selectOption("low");
}
async function ready(page: Page) {
  await page.getByRole("button", { name: "確定出戰", exact: true }).click();
  await page
    .getByRole("button", { name: "鎖定發射並準備", exact: true })
    .click();
}

test("friend room plays to a result, rematches, and handles a disconnected guest", async ({
  browser,
}) => {
  const hostContext = await browser.newContext();
  const guestContext = await browser.newContext();
  const host = await hostContext.newPage();
  const guest = await guestContext.newPage();
  const errors: string[] = [];
  host.on("pageerror", (error) => errors.push(error.message));
  guest.on("pageerror", (error) => errors.push(error.message));
  try {
    await menu(host);
    await menu(guest);
    await host.getByRole("button", { name: "線上對戰", exact: true }).click();
    await host.getByRole("button", { name: "建立好友房", exact: true }).click();
    await expect(host.locator(".room-code-display")).toBeVisible();
    const code = await host.locator(".room-code-display").innerText();
    await guest.getByRole("button", { name: "線上對戰", exact: true }).click();
    await guest.getByLabel("輸入好友的房號").fill(code);
    await guest.getByRole("button", { name: "加入", exact: true }).click();
    await ready(host);
    await ready(guest);
    await expect(host.locator("main")).toHaveClass(/phase-battle/);
    await expect(guest.locator("main")).toHaveClass(/phase-battle/);
    await expect(host.locator(".battle-canvas canvas")).toBeVisible();
    await expect(guest.locator(".battle-canvas canvas")).toBeVisible();
    await expect(host.locator("main")).toHaveClass(/phase-result/, {
      timeout: 50_000,
    });
    await expect(guest.locator("main")).toHaveClass(/phase-result/);
    await host
      .getByRole("button", { name: "再戰（可重選陀螺）", exact: true })
      .click();
    await guest
      .getByRole("button", { name: "對手想再戰，接受", exact: true })
      .click();
    await ready(host);
    await ready(guest);
    await expect(host.locator("main")).toHaveClass(/phase-battle/);
    await guestContext.close();
    await expect(
      host.getByRole("heading", { name: "對手已離開", exact: true }),
    ).toBeVisible({ timeout: 40_000 });
    await host.getByRole("button", { name: "返回主選單", exact: true }).click();
    await expect(
      host.getByRole("button", { name: "線上對戰", exact: true }),
    ).toBeVisible();
    expect(errors).toEqual([]);
  } finally {
    await hostContext.close();
    await guestContext.close();
  }
});

test("quality persists, the customizer loads, and the high-quality local launch renders", async ({
  page,
}, testInfo) => {
  let renderedCalls = 0;
  page.on("console", (message) => {
    const match = message.text().match(/\[perf\] calls\/frame=(\d+)/);
    if (match) renderedCalls = Number(match[1]);
  });
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await menu(page);
  await page.getByLabel("畫質", { exact: true }).selectOption("high");
  await page.reload();
  await expect(page.locator(".intro-screen")).toHaveCount(0);
  await expect(page.getByLabel("畫質", { exact: true })).toHaveValue("high");
  await page
    .getByRole("button", { name: "開啟零件改裝工坊", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "關閉", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "關閉", exact: true }).click();
  await page.screenshot({ path: testInfo.outputPath("menu.png") });
  await page.getByRole("button", { name: "單機 VS AI", exact: true }).click();
  await page.locator(".launch-screen").click();
  await expect(page.locator("main")).toHaveClass(/phase-battle/);
  await expect(page.locator(".battle-canvas canvas")).toBeVisible();
  await expect.poll(() => renderedCalls).toBeGreaterThan(10);
  await page.screenshot({ path: testInfo.outputPath("battle.png") });
  await page.getByRole("button", { name: "退出戰鬥", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "單機 VS AI", exact: true }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});
