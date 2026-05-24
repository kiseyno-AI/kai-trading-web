import { expect, type Page, test } from "@playwright/test";

async function expectToolbarChromeContained(
  page: Page,
  {
    status,
    subtitle,
    title,
  }: {
    status: string;
    subtitle: string;
    title: string;
  },
) {
  const toolbar = page.locator("[data-dashboard-toolbar]").first();
  await expect(toolbar).toBeVisible();
  await expect(toolbar.locator("[data-dashboard-toolbar-title]")).toHaveText(title);
  await expect(toolbar.locator("[data-dashboard-toolbar-subtitle]")).toHaveText(subtitle);
  await expect(toolbar.getByText(status, { exact: true })).toBeVisible();
  await expect(page.getByTestId("dashboard-header-language-switch")).toBeVisible();

  const metrics = await toolbar.evaluate((element) => {
    const measuredNodes = [
      ...Array.from(
        element.querySelectorAll<HTMLElement>(
          "[data-dashboard-toolbar-title], [data-dashboard-toolbar-subtitle], .pill, [data-testid='dashboard-header-language-switch']",
        ),
      ),
    ];
    const toolbarRect = element.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const pageScrollWidth = Math.max(document.documentElement.scrollWidth, document.body.scrollWidth);

    const clippedOrEscaped = measuredNodes.flatMap((node) => {
      const style = window.getComputedStyle(node);
      const rect = node.getBoundingClientRect();
      const hidden = style.display === "none" || style.visibility === "hidden" || rect.width === 0 || rect.height === 0;

      if (hidden) return [];

      const clipsOwnText = node.scrollWidth > node.clientWidth + 1;
      const escapesToolbar =
        rect.left < toolbarRect.left - 0.75 ||
        rect.right > toolbarRect.right + 0.75 ||
        rect.top < toolbarRect.top - 0.75 ||
        rect.bottom > toolbarRect.bottom + 0.75;

      if (!clipsOwnText && !escapesToolbar) return [];

      return [
        {
          clientWidth: node.clientWidth,
          scrollWidth: node.scrollWidth,
          text: node.innerText.trim().replace(/\s+/g, " "),
        },
      ];
    });

    return { clippedOrEscaped, pageScrollWidth, viewportWidth };
  });

  expect(metrics.clippedOrEscaped).toEqual([]);
  expect(metrics.pageScrollWidth).toBeLessThanOrEqual(metrics.viewportWidth + 1);
}

test("markets mobile toolbar keeps route context and controls legible at 320px", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 844 });
  await page.goto("/markets");

  await expect(page.getByRole("heading", { name: "Markets" })).toBeVisible();
  await expectToolbarChromeContained(page, {
    status: "Market data pending",
    subtitle: "Market state and screening",
    title: "Markets",
  });

  await page.getByRole("button", { name: "Korean" }).click();
  await expect(page.getByRole("heading", { name: "마켓" })).toBeVisible();
  await expectToolbarChromeContained(page, {
    status: "마켓 데이터 대기 중",
    subtitle: "마켓 상태와 스크리닝",
    title: "마켓",
  });

  await page.getByRole("button", { name: "영어" }).click();
  await expectToolbarChromeContained(page, {
    status: "Market data pending",
    subtitle: "Market state and screening",
    title: "Markets",
  });
});
