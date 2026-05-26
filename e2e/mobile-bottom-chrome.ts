import { expect, type Locator, type Page } from "@playwright/test";

export async function expectMobileContentClearsBottomChrome(page: Page, content: Locator, minimumGap = 8) {
  await content.scrollIntoViewIfNeeded();
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await expect
    .poll(() =>
      page.evaluate(() => window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 2),
    )
    .toBe(true);

  const metrics = await content.evaluate((element) => {
    const bottomNav = document.querySelector(
      'nav[aria-label="Primary"], nav[aria-label="기본 내비게이션"]',
    );
    const bottomChrome = bottomNav?.parentElement;

    if (!(bottomChrome instanceof HTMLElement)) {
      return null;
    }

    const contentRect = element.getBoundingClientRect();
    const chromeRect = bottomChrome.getBoundingClientRect();

    return {
      chromeTop: chromeRect.top,
      clearance: chromeRect.top - contentRect.bottom,
      contentBottom: contentRect.bottom,
    };
  });

  if (!metrics) {
    throw new Error("Expected mobile bottom chrome to be rendered.");
  }

  expect(metrics.clearance).toBeGreaterThanOrEqual(minimumGap);
}
