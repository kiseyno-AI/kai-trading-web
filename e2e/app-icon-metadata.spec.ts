import { expect, test } from "@playwright/test";

import { chromiumIPhone13 } from "./devices";

test.use(chromiumIPhone13);

test.describe("app icon metadata", () => {
  test("dashboard exposes install metadata for iPhone and Android", async ({ page, request }) => {
    await page.goto("/dashboard");

    await expect(page.locator('link[rel="apple-touch-icon"]')).toHaveAttribute("href", /\/apple-icon\.png\?/);
    await expect(page.locator('link[rel="apple-touch-icon"]')).toHaveAttribute("sizes", "180x180");
    await expect(page.locator('meta[name="apple-mobile-web-app-capable"]')).toHaveAttribute("content", "yes");
    await expect(page.locator('meta[name="apple-mobile-web-app-title"]')).toHaveAttribute("content", "KAI Trading");

    const manifestHref = await page.locator('link[rel="manifest"]').getAttribute("href");
    expect(manifestHref).toBeTruthy();

    const manifestUrl = new URL(manifestHref!, page.url()).toString();
    const manifestResponse = await request.get(manifestUrl);

    expect(manifestResponse.ok()).toBeTruthy();
    await expect(page.locator('link[rel="manifest"]')).toHaveAttribute("href", "/manifest.webmanifest");

    const manifest = (await manifestResponse.json()) as {
      icons?: Array<{ src: string; sizes: string; type: string; purpose?: string }>;
    };

    const manifest512Icons =
      manifest.icons?.filter(
        (icon) =>
          icon.src === "/app-icon-512.png" && icon.sizes === "512x512" && icon.type === "image/png",
      ) ?? [];

    expect(manifest.icons).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          src: "/app-icon-192.png",
          sizes: "192x192",
          type: "image/png",
        }),
      ]),
    );
    expect(manifest512Icons).toHaveLength(2);
    expect(manifest512Icons.filter((icon) => icon.purpose !== "maskable")).toHaveLength(1);
    expect(manifest512Icons.filter((icon) => icon.purpose === "maskable")).toHaveLength(1);
  });
});
