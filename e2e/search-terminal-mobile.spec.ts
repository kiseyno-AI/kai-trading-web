import { expect, test, type Locator, type Page } from "@playwright/test";

import { chromiumIPhone13 } from "./devices";
import { expectMobileContentClearsBottomChrome } from "./mobile-bottom-chrome";

test.use(chromiumIPhone13);

function getQuickAccessSection(page: Page) {
  return page.locator("section", { has: page.getByRole("heading", { name: /Quick Access|빠른 접근/ }) }).first();
}

async function expectMinimumTargetSize(locator: Locator, minimumSize = 44) {
  const box = await locator.boundingBox();

  if (!box) {
    throw new Error("Expected quick-access add control to have a rendered bounding box");
  }

  expect(box.width).toBeGreaterThanOrEqual(minimumSize);
  expect(box.height).toBeGreaterThanOrEqual(minimumSize);

  return box;
}

async function expectVisibleAffordance(locator: Locator) {
  const styles = await locator.evaluate((element) => {
    const computedStyles = window.getComputedStyle(element);

    return {
      backgroundColor: computedStyles.backgroundColor,
      borderWidth: Number.parseFloat(computedStyles.borderTopWidth),
    };
  });

  expect(styles.borderWidth).toBeGreaterThanOrEqual(1);
  expect(styles.backgroundColor).not.toBe("rgba(0, 0, 0, 0)");
}

async function expectMobileHiddenShellControlsSuppressed(page: Page, expectedLabels: string[]) {
  const hiddenShellControls = await page.locator("[data-app-chrome-hidden-when-mobile]").evaluateAll((containers) =>
    containers.flatMap((container) =>
      Array.from(container.querySelectorAll<HTMLElement>("a[href], button, input, select, textarea, [tabindex]")).map(
        (element) => {
          const rect = element.getBoundingClientRect();

          return {
            hiddenAncestor: Boolean(element.closest("[aria-hidden='true'], [inert]")),
            label: (element.getAttribute("aria-label") || element.textContent || "").replace(/\s+/g, " ").trim(),
            tabIndex: element.tabIndex,
            zeroRect: rect.width === 0 && rect.height === 0,
          };
        },
      ),
    ),
  );

  expect(hiddenShellControls.map((control) => control.label)).toEqual(expect.arrayContaining(expectedLabels));
  expect(hiddenShellControls.filter((control) => control.tabIndex >= 0)).toEqual([]);
  expect(hiddenShellControls.filter((control) => control.zeroRect && !control.hiddenAncestor)).toEqual([]);
}

async function expectFirstTabTargetVisible(page: Page) {
  await page.evaluate(() => {
    document.body.setAttribute("tabindex", "-1");
    document.body.focus();
    document.body.removeAttribute("tabindex");
  });

  let activeTarget: {
    hiddenShellAncestor: boolean;
    label: string;
    rect: { height: number; width: number } | null;
  } | null = null;

  for (let tabPress = 0; tabPress < 8; tabPress += 1) {
    await page.keyboard.press("Tab");
    activeTarget = await page.evaluate(() => {
      const element = document.activeElement as HTMLElement | null;
      const rect = element?.getBoundingClientRect();

      if (!element?.closest("[data-app-chrome-root]")) return null;

      return {
        hiddenShellAncestor: Boolean(element.closest("[data-app-chrome-hidden-when-mobile]")),
        label: (element.getAttribute("aria-label") || element.textContent || "").replace(/\s+/g, " ").trim(),
        rect: rect
          ? {
              height: rect.height,
              width: rect.width,
            }
          : null,
      };
    });

    if (activeTarget) break;
  }

  if (!activeTarget) {
    throw new Error("Expected Tab to reach a visible app chrome target");
  }

  expect(activeTarget.hiddenShellAncestor).toBe(false);
  expect(activeTarget.rect?.width ?? 0).toBeGreaterThan(0);
  expect(activeTarget.rect?.height ?? 0).toBeGreaterThan(0);
}

async function stubEmptySearchData(page: Page) {
  await page.route("**/api/trading/market/status", async (route) => {
    await route.fulfill({
      json: {
        is_open: false,
        server_time: "2026-05-30T00:01:00+09:00",
        state: "CLOSED",
      },
    });
  });
  await page.route("**/api/trading/symbols/favorites", async (route) => {
    await route.fulfill({ json: { count: 0, items: [] } });
  });
  await page.route("**/api/trading/scanner/tracked-symbols", async (route) => {
    await route.fulfill({
      json: {
        count: 0,
        last_updated_at: "2026-05-30T00:01:00+09:00",
        tracked_symbols: [],
      },
    });
  });
  await page.route("**/api/trading/symbols/search?**", async (route) => {
    await route.fulfill({ json: { count: 0, items: [], query: "" } });
  });
  await page.route("**/api/trading/scanner/realtime-trending?**", async (route) => {
    await route.fulfill({
      json: {
        as_of: "2026-05-30T00:01:00+09:00",
        items: [],
        market: "KRX",
        source: "kis",
        status: "ok",
        summary: { item_count: 0 },
      },
    });
  });
}

test.describe("search terminal mobile", () => {
  test("renders mobile terminal chrome and bottom tabs", async ({ page }) => {
    await page.goto("/search");

    const topbar = page.locator("header.topbar");
    await expect(topbar).toBeVisible();
    await expect
      .poll(() => topbar.evaluate((element) => window.getComputedStyle(element).position))
      .toBe("fixed");

    await expect(page.getByRole("navigation", { name: /^Primary$/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /Search/i })).toBeVisible();
    await expect(page.getByLabel(/Search markets, symbols, or analysis/i)).toBeVisible();
    await expect(page.getByLabel(/Search suggestions/i)).toHaveCount(0);
    await expect(page.getByRole("heading", { name: /Trending Symbols/i })).toBeVisible();
    await expect(page.getByText(/Network Integrity/i)).toHaveCount(0);
  });

  test("contains trending tab captions inside narrow mobile tabs", async ({ page }) => {
    await stubEmptySearchData(page);
    await page.goto("/search");

    const trendingSection = page
      .locator("section")
      .filter({ has: page.getByRole("heading", { name: /Trending Symbols/i }) })
      .first();
    await expect(trendingSection.getByRole("tab", { name: /Live KIS ranks/i })).toBeVisible();

    const captionMetrics = await trendingSection.evaluate((section) =>
      Array.from(section.querySelectorAll<HTMLElement>("[role='tab']")).flatMap((tab) => {
        const caption = tab.querySelector<HTMLElement>("small");
        if (!caption) return [];

        const tabRect = tab.getBoundingClientRect();
        const captionRect = caption.getBoundingClientRect();
        const range = document.createRange();
        range.selectNodeContents(caption);
        const lineCount = new Set(
          Array.from(range.getClientRects())
            .filter((rect) => rect.width > 0 && rect.height > 0)
            .map((rect) => Math.round(rect.top)),
        ).size;
        range.detach();

        return [
          {
            captionBottom: Math.round(captionRect.bottom),
            captionLeft: Math.round(captionRect.left),
            captionRight: Math.round(captionRect.right),
            captionTop: Math.round(captionRect.top),
            clientHeight: caption.clientHeight,
            clientWidth: caption.clientWidth,
            lineCount,
            scrollHeight: caption.scrollHeight,
            scrollWidth: caption.scrollWidth,
            tabBottom: Math.round(tabRect.bottom),
            tabLeft: Math.round(tabRect.left),
            tabRight: Math.round(tabRect.right),
            tabTop: Math.round(tabRect.top),
            text: caption.innerText.trim().replace(/\s+/g, " "),
          },
        ];
      }),
    );

    expect(captionMetrics.map((metric) => metric.text)).toEqual([
      "Live KIS ranks",
      "One-day movers",
      "Five-day movers",
      "Twenty-day movers",
    ]);
    expect(
      captionMetrics.filter((metric) => {
        const clipsInline = metric.scrollWidth > metric.clientWidth + 1;
        const clipsBlock = metric.scrollHeight > metric.clientHeight + 1;
        const crossesTabBounds =
          metric.captionLeft < metric.tabLeft - 1 ||
          metric.captionRight > metric.tabRight + 1 ||
          metric.captionTop < metric.tabTop - 1 ||
          metric.captionBottom > metric.tabBottom + 1;
        const wrapsPastTwoLines = metric.lineCount > 2;

        return clipsInline || clipsBlock || crossesTabBounds || wrapsPastTwoLines;
      }),
    ).toEqual([]);
  });

  test("trending rows scroll clear of the mobile bottom nav", async ({ page }) => {
    await page.route("**/api/trading/symbols/favorites", async (route) => {
      await route.fulfill({ json: { count: 0, items: [] } });
    });
    await page.route("**/api/trading/scanner/tracked-symbols", async (route) => {
      await route.fulfill({
        json: {
          count: 0,
          last_updated_at: "2026-05-27T09:00:00+09:00",
          tracked_symbols: [],
        },
      });
    });
    await page.route("**/api/trading/symbols/search?**", async (route) => {
      await route.fulfill({ json: { count: 0, items: [], query: "" } });
    });
    await page.route("**/api/trading/scanner/realtime-trending?**", async (route) => {
      await route.fulfill({
        json: {
          as_of: "2026-05-27T09:00:00+09:00",
          items: Array.from({ length: 6 }, (_, index) => ({
            best_rank: index + 1,
            change_pct: 0.42 - index / 10,
            market: "KRX",
            name: `KAI Bottom ${index + 1}`,
            price: 71000 + index * 100,
            source_count: 1,
            sources: [
              {
                metric: { name: "volume", unit: "shares", value: 250000 - index * 1000 },
                rank: index + 1,
                source: "volume-rank",
                source_label: "volume-rank",
              },
            ],
            symbol: `00900${index + 1}`,
          })),
          market: "KRX",
          source: "kis",
          status: "ok",
          summary: { item_count: 6 },
        },
      });
    });
    await page.route("**/api/trading/scanner/trending-stocks?**", async (route) => {
      await route.fulfill({
        json: {
          items: [],
          request: { period: "1d", resolved_market_date: "2026-05-27" },
          summary: { item_count: 0 },
        },
      });
    });

    await page.goto("/search");

    const trendingSection = page.locator("section", {
      has: page.getByRole("heading", { name: /Trending Symbols/i }),
    });
    const lastTrendingRow = trendingSection.getByRole("button", { name: /KAI Bottom 5/i });
    await expect(lastTrendingRow).toBeVisible();

    await expectMobileContentClearsBottomChrome(page, lastTrendingRow);
  });

  test("keeps the quick-access favorite add control easy to tap and keyboard reachable", async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem("trading-web.locale", JSON.stringify("ko"));
    });
    await page.route("**/api/trading/symbols/favorites", async (route) => {
      await route.fulfill({
        json: {
          count: 0,
          items: [],
        },
      });
    });
    await page.route("**/api/trading/scanner/tracked-symbols", async (route) => {
      await route.fulfill({
        json: {
          tracked_symbols: [],
          count: 0,
          last_updated_at: "2026-04-14T08:55:00+09:00",
        },
      });
    });
    await page.route("**/api/trading/symbols/search?**", async (route) => {
      await route.fulfill({
        json: {
          query: "",
          count: 0,
          items: [],
        },
      });
    });

    await page.goto("/search");

    const quickSection = getQuickAccessSection(page);
    const addControl = quickSection.getByRole("button", { name: "즐겨찾기 검색 열기" });
    await expect(addControl).toContainText(/즐겨찾기 없음/i);
    await expect(addControl).toHaveAccessibleName("즐겨찾기 검색 열기");
    await expect(addControl).toHaveAccessibleDescription("즐겨찾기 없음");
    await expect(addControl).toHaveAttribute("aria-describedby", "quick-access-status");
    await expect(page.locator("#quick-access-status")).toHaveText("즐겨찾기 없음");

    const addControlBox = await expectMinimumTargetSize(addControl);
    await expectVisibleAffordance(addControl);

    await page.getByLabel(/마켓, 종목 또는 분석 검색/i).focus();
    await page.keyboard.press("Tab");
    await expect(addControl).toBeFocused();

    const focusStyle = await addControl.evaluate((element) => {
      const styles = window.getComputedStyle(element);

      return {
        outlineStyle: styles.outlineStyle,
        outlineWidth: Number.parseFloat(styles.outlineWidth),
      };
    });
    expect(focusStyle.outlineStyle).not.toBe("none");
    expect(focusStyle.outlineWidth).toBeGreaterThanOrEqual(2);

    await page.keyboard.press("Enter");
    const dialog = page.getByRole("dialog", { name: /종목 저장/i });
    await expect(dialog).toBeVisible();
    await expect(page.getByLabel(/즐겨찾기 종목 검색/i)).toBeFocused();

    await page.getByRole("button", { name: /즐겨찾기 검색 닫기/i }).click();
    await expect(dialog).toHaveCount(0);

    await addControl.click({
      position: {
        x: Math.max(addControlBox.width - 8, 1),
        y: addControlBox.height / 2,
      },
    });
    await expect(page.getByRole("dialog", { name: /종목 저장/i })).toBeVisible();
  });

  test("removes hidden shared shell controls from the mobile tab order", async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem("trading-web.locale", JSON.stringify("ko"));
    });

    await page.goto("/search");
    await expect(page.getByLabel(/마켓, 종목 또는 분석 검색/i)).toBeVisible();
    await expectMobileHiddenShellControlsSuppressed(page, [
      "대시보드",
      "검색",
      "캘린더",
      "자산",
      "내 종목",
      "영어",
      "한국어",
      "태그 꺼짐",
    ]);
    await expectFirstTabTargetVisible(page);

    await page.goto("/calendar");
    await expect(page.getByRole("heading", { name: /시그널 리뷰 캘린더|Signal Review Calendar/i })).toBeVisible();
    await expectMobileHiddenShellControlsSuppressed(page, [
      "대시보드",
      "검색",
      "캘린더",
      "자산",
      "내 종목",
      "영어",
      "한국어",
    ]);
    await expectFirstTabTargetVisible(page);
  });

  test("labels unsupported favorite coverage on mobile quick access without exposing a detail shortcut", async ({
    page,
  }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem("trading-web.locale", JSON.stringify("ko"));
    });
    await page.route("**/api/trading/symbols/favorites", async (route) => {
      await route.fulfill({
        json: {
          count: 1,
          items: [
            {
              symbol: "F70100026",
              standard_code: null,
              name_ko: "한투글로벌넥스트웨이브1(A)",
              market: "KOSPI",
              instrument_type: "fund",
              is_active: true,
              sort_order: 0,
              favorited_at: "2026-05-23T06:30:00+09:00",
            },
          ],
        },
      });
    });
    await page.route("**/api/trading/scanner/tracked-symbols", async (route) => {
      await route.fulfill({
        json: {
          tracked_symbols: [],
          count: 0,
          last_updated_at: null,
        },
      });
    });
    await page.route("**/api/trading/symbols/search?**", async (route) => {
      await route.fulfill({
        json: {
          query: "",
          count: 0,
          items: [],
        },
      });
    });
    await page.route("**/api/trading/scanner/realtime-trending?**", async (route) => {
      await route.fulfill({
        json: {
          status: "ok",
          source: "kis",
          as_of: "2026-04-14T16:00:00+09:00",
          market: "KRX",
          summary: {
            item_count: 0,
          },
          items: [],
        },
      });
    });

    await page.goto("/search");

    const quickSection = getQuickAccessSection(page);
    const unsupportedFavorite = quickSection.getByRole("group", { name: /F70100026.*지원 제한/ });
    await expect(unsupportedFavorite).toBeVisible();
    await expect(unsupportedFavorite).toContainText("지원 제한");
    await expect(unsupportedFavorite).toContainText("주식 상세 커버리지 밖");
    await expect(quickSection.locator('a[href*="/dashboard/symbol/F70100026"]')).toHaveCount(0);
    await expect(unsupportedFavorite.getByRole("button", { name: /즐겨찾기 제거 F70100026/ })).toBeVisible();

    const [cardBox, viewport] = await Promise.all([
      unsupportedFavorite.boundingBox(),
      page.evaluate(() => ({ width: window.innerWidth, height: window.innerHeight })),
    ]);
    expect(cardBox).not.toBeNull();
    expect(cardBox!.x).toBeGreaterThanOrEqual(0);
    expect(cardBox!.x + cardBox!.width).toBeLessThanOrEqual(viewport.width);
  });

  test("keeps Q1 autocomplete hidden for a blank search even if the endpoint has default matches", async ({ page }) => {
    const searchRequests: string[] = [];

    await page.route("**/api/trading/symbols/favorites", async (route) => {
      await route.fulfill({
        json: {
          count: 0,
          items: [],
        },
      });
    });
    await page.route("**/api/trading/scanner/tracked-symbols", async (route) => {
      await route.fulfill({
        json: {
          tracked_symbols: [],
          count: 0,
          last_updated_at: null,
        },
      });
    });
    await page.route("**/api/trading/symbols/search?**", async (route) => {
      const requestUrl = new URL(route.request().url());
      const query = requestUrl.searchParams.get("q") ?? "";
      searchRequests.push(query);

      await route.fulfill({
        json: {
          query,
          count: query === "005930" ? 1 : 20,
          items:
            query === "005930"
              ? [
                  {
                    symbol: "005930",
                    standard_code: "KR7005930003",
                    name_ko: "Samsung Electronics",
                    market: "KOSPI",
                  },
                ]
              : [
                  {
                    symbol: "000001",
                    standard_code: "KR7000000001",
                    name_ko: "Default Result",
                    market: "KOSPI",
                  },
                ],
        },
      });
    });
    await page.route("**/api/trading/scanner/realtime-trending?**", async (route) => {
      await route.fulfill({
        json: {
          status: "ok",
          source: "kis",
          as_of: "2026-04-14T09:00:00Z",
          market: "KRX",
          summary: {
            item_count: 0,
          },
          items: [],
        },
      });
    });

    await page.goto("/search");

    await expect(page.getByLabel(/Search suggestions/i)).toHaveCount(0);
    await expect(page.getByText(/Start typing to search the symbol master/i)).toHaveCount(0);
    await expect(page.getByRole("link", { name: /000001.*Default Result/i })).toHaveCount(0);
    await page.waitForTimeout(250);
    expect(searchRequests).toEqual([]);

    await page.getByLabel(/Search markets, symbols, or analysis/i).fill("005930");

    await expect(page.getByRole("link", { name: /005930.*Samsung Electronics/i }).first()).toBeVisible();
    await expect.poll(() => searchRequests).toEqual(["005930"]);
  });

  test("keeps mobile search content visible when quick access API is unavailable", async ({ page }) => {
    await page.route("**/api/trading/symbols/favorites", async (route) => {
      await route.fulfill({
        status: 503,
        json: { error: "favorites unavailable" },
      });
    });
    await page.route("**/api/trading/scanner/tracked-symbols", async (route) => {
      await route.fulfill({
        json: {
          tracked_symbols: ["005930"],
          count: 1,
          last_updated_at: "2026-04-14T09:00:00+09:00",
        },
      });
    });
    await page.route("**/api/trading/symbols/search?**", async (route) => {
      const requestUrl = new URL(route.request().url());
      const query = requestUrl.searchParams.get("q");

      await route.fulfill({
        json: {
          query: query ?? "",
          count: query === "005930" ? 1 : 0,
          items:
            query === "005930"
              ? [
                  {
                    symbol: "005930",
                    standard_code: "KR7005930003",
                    name_ko: "Samsung Electronics",
                    market: "KOSPI",
                  },
                ]
              : [],
        },
      });
    });
    await page.route("**/api/trading/scanner/realtime-trending?**", async (route) => {
      await route.fulfill({
        json: {
          status: "ok",
          source: "kis",
          as_of: "2026-04-14T09:00:00Z",
          market: "KRX",
          summary: {
            item_count: 1,
          },
          items: [
            {
              symbol: "000660",
              name: "SK hynix",
              market: "KRX",
              price: 182000,
              change_pct: -1.5,
              best_rank: 1,
              source_count: 1,
              sources: [
                {
                  source: "fluctuation",
                  source_label: "fluctuation",
                  rank: 1,
                  metric: { name: "change_pct", value: -1.5, unit: "percent" },
                },
              ],
            },
          ],
        },
      });
    });

    await page.goto("/search");
    await page.getByLabel(/Search markets, symbols, or analysis/i).fill("005930");

    const quickSection = page.locator("section").filter({ has: page.getByRole("heading", { name: "Quick Access" }) }).first();
    await expect(quickSection.getByRole("button", { name: /Open favorite search/i })).toHaveAccessibleDescription(
      "Unavailable",
    );
    await expect(quickSection.locator("strong").filter({ hasText: /^Unavailable$/ })).toBeVisible();
    await expect(quickSection.getByText(/Favorite list unavailable\. HTTP 503/i)).toBeVisible();
    await expect(page.getByRole("link", { name: /005930.*Samsung Electronics/i }).first()).toBeVisible();
    await expect(page.getByRole("heading", { name: /Trending Symbols/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /SK hynix.*000660/i })).toBeVisible();
    await expect(page.getByText(/Network Integrity/i)).toHaveCount(0);
  });

  test("Q4 shows exact trending symbols by source and extends from the More button", async ({ page }) => {
    await page.route("**/api/trading/symbols/favorites", async (route) => {
      await route.fulfill({
        json: {
          count: 0,
          items: [],
        },
      });
    });
    await page.route("**/api/trading/scanner/tracked-symbols", async (route) => {
      await route.fulfill({
        json: {
          tracked_symbols: [],
          count: 0,
          last_updated_at: null,
        },
      });
    });
    await page.route("**/api/trading/symbols/search?**", async (route) => {
      await route.fulfill({
        json: {
          query: "",
          count: 0,
          items: [],
        },
      });
    });
    await page.route("**/api/trading/scanner/realtime-trending?**", async (route) => {
      await route.fulfill({
        json: {
          status: "ok",
          source: "kis",
          as_of: "2026-04-14T09:00:00Z",
          market_code: "J",
          market: "KRX",
          limit_per_source: 5,
          sources: [],
          summary: {
            item_count: 6,
          },
          items: [
            {
              symbol: "005930",
              name: "Samsung Electronics",
              market: "KRX",
              price: 71500,
              change_pct: 0.84,
              best_rank: 1,
              source_count: 2,
              sources: [
                {
                  source: "volume-rank",
                  source_label: "volume-rank",
                  rank: 1,
                  metric: { name: "volume", value: 250000, unit: "shares" },
                },
              ],
            },
            {
              symbol: "000660",
              name: "SK hynix",
              market: "KRX",
              price: 182000,
              change_pct: -1.5,
              best_rank: 2,
              source_count: 1,
              sources: [
                {
                  source: "fluctuation",
                  source_label: "fluctuation",
                  rank: 2,
                  metric: { name: "change_pct", value: -1.5, unit: "percent" },
                },
              ],
            },
            {
              symbol: "373220",
              name: "LG Energy Solution",
              market: "KRX",
              change_pct: 2.12,
              best_rank: 3,
              source_count: 1,
              sources: [
                {
                  source: "volume-rank",
                  source_label: "volume-rank",
                  rank: 3,
                  metric: { name: "volume", value: 180000, unit: "shares" },
                },
              ],
            },
            {
              symbol: "207940",
              name: "Samsung Biologics",
              market: "KRX",
              change_pct: 1.42,
              best_rank: 4,
              source_count: 1,
              sources: [
                {
                  source: "hts-top-view",
                  source_label: "hts-top-view",
                  rank: 4,
                  metric: { name: "view_rank", value: 4, unit: "rank" },
                },
              ],
            },
            {
              symbol: "006400",
              name: "Samsung SDI",
              market: "KRX",
              change_pct: -0.32,
              best_rank: 5,
              source_count: 1,
              sources: [
                {
                  source: "volume-rank",
                  source_label: "volume-rank",
                  rank: 5,
                  metric: { name: "volume", value: 130000, unit: "shares" },
                },
              ],
            },
            {
              symbol: "035420",
              name: "NAVER",
              market: "KRX",
              change_pct: 0.21,
              best_rank: 6,
              source_count: 1,
              sources: [
                {
                  source: "fluctuation",
                  source_label: "fluctuation",
                  rank: 6,
                  metric: { name: "change_pct", value: 0.21, unit: "percent" },
                },
              ],
            },
          ],
        },
      });
    });
    await page.route("**/api/trading/scanner/trending-stocks?**", async (route) => {
      const requestUrl = new URL(route.request().url());
      const period = requestUrl.searchParams.get("period") ?? "5d";
      const items =
        period === "5d"
          ? [
              {
                rank: 1,
                symbol: "086520",
                name_ko: "EcoPro",
                market: "KOSDAQ",
                market_date: "2026-04-14",
                trend_direction: "up",
                metric: { period: "5d", name: "return_5d_pct", value: 12.45 },
                price: null,
                technical: { close_price: 94200 },
                action_summary: null,
              },
            ]
          : [
              {
                rank: 1,
                symbol: "068270",
                name_ko: "Celltrion",
                market: "KOSPI",
                market_date: "2026-04-14",
                trend_direction: "up",
                metric: { period, name: `${period}_return_pct`, value: 4.2 },
                price: null,
                technical: { close_price: 184500 },
                action_summary: null,
              },
            ];

      await route.fulfill({
        json: {
          request: {
            resolved_market_date: "2026-04-14",
            period,
            direction: "both",
            limit: Number(requestUrl.searchParams.get("limit") ?? 5),
            markets: null,
          },
          summary: {
            count: items.length,
            data_available: true,
          },
          items,
        },
      });
    });

    await page.goto("/search");

    const trendingSection = page.locator("section").filter({ has: page.getByRole("heading", { name: /Trending Symbols/i }) }).first();
    const trendingIdentityFor = (symbol: string) =>
      trendingSection.getByRole("button", { name: new RegExp(symbol) }).locator("[class*='trendingIdentity']");
    const trendingMetricFor = (symbol: string) =>
      trendingSection.getByRole("button", { name: new RegExp(symbol) }).locator("[class*='trendingMetric'] strong");

    await expect(trendingSection.getByText("OK · 26-04-14", { exact: true })).toBeVisible();
    await expect(trendingSection.getByText("OK · 26-04-14 : 18:00:00", { exact: true })).toHaveCount(0);
    await expect(trendingSection.getByText("005930", { exact: true })).toBeVisible();
    await expect(trendingIdentityFor("005930").locator("strong")).toHaveText("Samsung Electronics");
    await expect(trendingIdentityFor("005930").locator("small")).toHaveText("005930");
    await expect(trendingMetricFor("005930")).toHaveText("250,000");
    await expect(trendingSection.getByText("000660", { exact: true })).toBeVisible();
    await expect(trendingMetricFor("000660")).toHaveText("-1.50%");
    await expect(trendingMetricFor("207940")).toHaveText("#4");
    await expect(trendingSection.getByText("035420", { exact: true })).toHaveCount(0);

    await trendingSection.getByRole("tab", { name: /KIS/i }).click();
    await expect(trendingSection.getByText("005930", { exact: true })).toBeVisible();
    await expect(trendingSection.getByText("000660", { exact: true })).toBeVisible();

    await trendingSection.getByRole("button", { name: /^More$/i }).click();
    await expect(trendingSection.getByText("035420", { exact: true })).toBeVisible();
    await expect(trendingMetricFor("035420")).toHaveText("+0.21%");

    await trendingSection.getByRole("tab", { name: /5D/i }).click();
    await expect(trendingSection.getByText("086520", { exact: true })).toBeVisible();
    await expect(trendingSection.getByText("005930", { exact: true })).toHaveCount(0);
  });

  test("labels ETF trending rows without opening unsupported symbol detail", async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem("trading-web.locale", JSON.stringify("ko"));
    });
    await page.route("**/api/trading/market/status", async (route) => {
      await route.fulfill({
        json: {
          state: "OPEN",
          is_open: true,
          server_time: "2026-04-14T09:00:00+09:00",
        },
      });
    });
    await page.route("**/api/trading/symbols/favorites", async (route) => {
      await route.fulfill({ json: { count: 0, items: [] } });
    });
    await page.route("**/api/trading/scanner/tracked-symbols", async (route) => {
      await route.fulfill({
        json: {
          tracked_symbols: [],
          count: 0,
          last_updated_at: null,
        },
      });
    });
    await page.route("**/api/trading/symbols/search?**", async (route) => {
      const requestUrl = new URL(route.request().url());
      const query = requestUrl.searchParams.get("q") ?? "";
      const items =
        query === "252670"
          ? [
              {
                symbol: "252670",
                standard_code: "KR7252670005",
                name_ko: "KODEX 200선물인버스2X",
                market: "KRX",
                instrument_type: "etf",
              },
            ]
          : query === "005930"
            ? [
                {
                  symbol: "005930",
                  standard_code: "KR7005930003",
                  name_ko: "삼성전자",
                  market: "KOSPI",
                  instrument_type: "stock",
                },
              ]
            : [];

      await route.fulfill({
        json: {
          query,
          count: items.length,
          items,
        },
      });
    });
    await page.route("**/api/trading/scanner/realtime-trending?**", async (route) => {
      await route.fulfill({
        json: {
          status: "ok",
          source: "kis",
          as_of: "2026-04-14T09:00:00+09:00",
          market: "KRX",
          summary: { item_count: 2 },
          items: [
            {
              symbol: "252670",
              name: "KODEX 200선물인버스2X",
              market: "KRX",
              price: 2140,
              change_pct: 1.82,
              best_rank: 1,
              source_count: 1,
              sources: [
                {
                  source: "volume-rank",
                  source_label: "volume-rank",
                  rank: 1,
                  metric: { name: "volume", value: 1290000, unit: "shares" },
                },
              ],
            },
            {
              symbol: "005930",
              name: "삼성전자",
              market: "KOSPI",
              price: 71500,
              change_pct: 0.84,
              best_rank: 2,
              source_count: 1,
              sources: [
                {
                  source: "fluctuation",
                  source_label: "fluctuation",
                  rank: 2,
                  metric: { name: "change_pct", value: 0.84, unit: "percent" },
                },
              ],
            },
          ],
        },
      });
    });

    await page.goto("/search");

    const trendingSection = page.locator("section").filter({ has: page.getByRole("heading", { name: "인기 종목" }) }).first();
    const unsupportedProduct = trendingSection.getByRole("group", { name: /252670.*지원 제한/ });
    await expect(unsupportedProduct).toBeVisible();
    await expect(unsupportedProduct).toContainText("KODEX 200선물인버스2X");
    await expect(unsupportedProduct).toContainText("지원 제한");
    await expect(unsupportedProduct).toContainText("주식 상세 커버리지 밖");
    await expect(trendingSection.getByRole("button", { name: /252670/ })).toHaveCount(0);

    await unsupportedProduct.click();
    expect(new URL(page.url()).pathname).toBe("/search");

    const horizontalOverflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(horizontalOverflow).toBeLessThanOrEqual(1);

    const supportedStock = trendingSection.getByRole("button", { name: /삼성전자.*005930/ });
    await expect(supportedStock).toBeVisible();
    await Promise.all([page.waitForURL(/\/dashboard\/symbol\/005930\?.*navContext=search/), supportedStock.click()]);
  });

  test("clears stale Q4 rows and shrinks the reserved height after a smaller source result set", async ({ page }) => {
    let releaseStoredTrending = () => {};

    await page.route("**/api/trading/symbols/favorites", async (route) => {
      await route.fulfill({
        json: {
          count: 0,
          items: [],
        },
      });
    });
    await page.route("**/api/trading/scanner/tracked-symbols", async (route) => {
      await route.fulfill({
        json: {
          tracked_symbols: [],
          count: 0,
          last_updated_at: null,
        },
      });
    });
    await page.route("**/api/trading/symbols/search?**", async (route) => {
      await route.fulfill({
        json: {
          query: "",
          count: 0,
          items: [],
        },
      });
    });
    await page.route("**/api/trading/scanner/realtime-trending?**", async (route) => {
      await route.fulfill({
        json: {
          status: "ok",
          source: "kis",
          as_of: "2026-04-14T09:00:00Z",
          market: "KRX",
          summary: {
            item_count: 5,
          },
          items: [
            {
              symbol: "005930",
              name: "Samsung Electronics",
              market: "KRX",
              price: 71500,
              change_pct: 0.84,
              best_rank: 1,
              source_count: 1,
              sources: [
                {
                  source: "volume-rank",
                  source_label: "volume-rank",
                  rank: 1,
                  metric: { name: "volume", value: 250000, unit: "shares" },
                },
              ],
            },
            {
              symbol: "000660",
              name: "SK hynix",
              market: "KRX",
              price: 182000,
              change_pct: -1.5,
              best_rank: 2,
              source_count: 1,
              sources: [
                {
                  source: "fluctuation",
                  source_label: "fluctuation",
                  rank: 2,
                  metric: { name: "change_pct", value: -1.5, unit: "percent" },
                },
              ],
            },
            {
              symbol: "373220",
              name: "LG Energy Solution",
              market: "KRX",
              change_pct: 2.12,
              best_rank: 3,
              source_count: 1,
              sources: [
                {
                  source: "volume-rank",
                  source_label: "volume-rank",
                  rank: 3,
                  metric: { name: "volume", value: 180000, unit: "shares" },
                },
              ],
            },
            {
              symbol: "207940",
              name: "Samsung Biologics",
              market: "KRX",
              change_pct: 1.42,
              best_rank: 4,
              source_count: 1,
              sources: [
                {
                  source: "hts-top-view",
                  source_label: "hts-top-view",
                  rank: 4,
                  metric: { name: "view_rank", value: 4, unit: "rank" },
                },
              ],
            },
            {
              symbol: "006400",
              name: "Samsung SDI",
              market: "KRX",
              change_pct: -0.32,
              best_rank: 5,
              source_count: 1,
              sources: [
                {
                  source: "volume-rank",
                  source_label: "volume-rank",
                  rank: 5,
                  metric: { name: "volume", value: 130000, unit: "shares" },
                },
              ],
            },
          ],
        },
      });
    });
    await page.route("**/api/trading/scanner/trending-stocks?**", async (route) => {
      const requestUrl = new URL(route.request().url());
      const period = requestUrl.searchParams.get("period") ?? "5d";

      if (period === "5d") {
        await new Promise<void>((resolve) => {
          releaseStoredTrending = resolve;
        });
      }

      await route.fulfill({
        json: {
          request: {
            resolved_market_date: "2026-04-14",
            period,
            direction: "both",
            limit: Number(requestUrl.searchParams.get("limit") ?? 5),
            markets: null,
          },
          summary: {
            count: 1,
            data_available: true,
          },
          items: [
            {
              rank: 1,
              symbol: "086520",
              name_ko: "EcoPro",
              market: "KOSDAQ",
              market_date: "2026-04-14",
              trend_direction: "up",
              metric: { period, name: `${period}_return_pct`, value: 12.45 },
              price: null,
              technical: { close_price: 94200 },
              action_summary: null,
            },
          ],
        },
      });
    });

    await page.goto("/search");

    const trendingSection = page.locator("section").filter({ has: page.getByRole("heading", { name: /Trending Symbols/i }) }).first();
    const trendingMeta = trendingSection.locator("h2 + span");
    const trendingList = trendingSection.locator("[class*='trendingList']");
    await expect(trendingSection.getByText("005930", { exact: true })).toBeVisible();
    await expect(trendingMeta).toHaveText("OK · 26-04-14");
    const startingListHeight = await trendingList.evaluate((element) => element.getBoundingClientRect().height);
    expect(startingListHeight).toBeGreaterThan(0);
    const startingScrollY = await page.evaluate(() => {
      const trendingHeading = Array.from(document.querySelectorAll("section h2")).find(
        (heading) => heading.textContent?.trim() === "Trending Symbols",
      );
      const section = trendingHeading?.closest("section");
      if (!section) return window.scrollY;

      const sectionTop = section.getBoundingClientRect().top + window.scrollY;
      const targetScrollY = Math.max(sectionTop - 96, 0);
      window.scrollTo(0, targetScrollY);
      return window.scrollY;
    });

    expect(startingScrollY).toBeGreaterThan(0);
    const startingSectionTop = await trendingSection.evaluate((element) => element.getBoundingClientRect().top);

    await trendingSection.getByRole("tab", { name: /5D/i }).click();

    await expect(trendingSection.getByText(/Loading 5D symbols/i)).toBeVisible();
    await expect(trendingMeta).toHaveText("Five-day movers");
    await expect(trendingSection.getByText("005930", { exact: true })).toHaveCount(0);
    await expect(trendingSection.locator("[aria-busy=\"true\"]")).toBeVisible();
    await expect(trendingSection.getByText("086520", { exact: true })).toHaveCount(0);
    const loadingListHeight = await trendingList.evaluate((element) => element.getBoundingClientRect().height);
    expect(Math.abs(loadingListHeight - startingListHeight)).toBeLessThanOrEqual(24);
    const loadingScrollY = await page.evaluate(() => window.scrollY);
    expect(Math.abs(loadingScrollY - startingScrollY)).toBeLessThanOrEqual(24);

    releaseStoredTrending();

    await expect(trendingMeta).toHaveText("Stored 5D · 2026-04-14");
    await expect(trendingSection.getByText("086520", { exact: true })).toBeVisible();
    await expect(trendingSection.getByText("005930", { exact: true })).toHaveCount(0);
    await expect(trendingSection.locator("[aria-busy=\"true\"]")).toHaveCount(0);
    const finalListHeight = await trendingList.evaluate((element) => element.getBoundingClientRect().height);
    expect(finalListHeight).toBeLessThan(startingListHeight);
    const finalSectionTop = await trendingSection.evaluate((element) => element.getBoundingClientRect().top);
    expect(Math.abs(finalSectionTop - startingSectionTop)).toBeLessThanOrEqual(24);
  });

  test("keeps Q4 stale rows and meta cleared when a source switch fails", async ({ page }) => {
    await page.route("**/api/trading/symbols/favorites", async (route) => {
      await route.fulfill({
        json: {
          count: 0,
          items: [],
        },
      });
    });
    await page.route("**/api/trading/scanner/tracked-symbols", async (route) => {
      await route.fulfill({
        json: {
          tracked_symbols: [],
          count: 0,
          last_updated_at: null,
        },
      });
    });
    await page.route("**/api/trading/symbols/search?**", async (route) => {
      await route.fulfill({
        json: {
          query: "",
          count: 0,
          items: [],
        },
      });
    });
    await page.route("**/api/trading/scanner/realtime-trending?**", async (route) => {
      await route.fulfill({
        json: {
          status: "ok",
          source: "kis",
          as_of: "2026-04-14T09:00:00Z",
          market: "KRX",
          summary: {
            item_count: 5,
          },
          items: [
            {
              symbol: "005930",
              name: "Samsung Electronics",
              market: "KRX",
              price: 71500,
              change_pct: 0.84,
              best_rank: 1,
              source_count: 1,
              sources: [
                {
                  source: "volume-rank",
                  source_label: "volume-rank",
                  rank: 1,
                  metric: { name: "volume", value: 250000, unit: "shares" },
                },
              ],
            },
          ],
        },
      });
    });
    await page.route("**/api/trading/scanner/trending-stocks?**", async (route) => {
      await route.fulfill({
        status: 503,
        json: {
          detail: "Unavailable",
        },
      });
    });

    await page.goto("/search");

    const trendingSection = page.locator("section").filter({ has: page.getByRole("heading", { name: /Trending Symbols/i }) }).first();
    const trendingMeta = trendingSection.locator("h2 + span");
    await expect(trendingSection.getByText("005930", { exact: true })).toBeVisible();
    await expect(trendingMeta).toHaveText("OK · 26-04-14");

    await trendingSection.getByRole("tab", { name: /5D/i }).click();

    await expect(trendingSection.getByText(/Trending symbols unavailable\..*HTTP 503/i)).toBeVisible();
    await expect(trendingMeta).toHaveText("Five-day movers");
    await expect(trendingSection.getByText("005930", { exact: true })).toHaveCount(0);
    await expect(trendingSection.locator("[aria-busy=\"true\"]")).toHaveCount(0);
  });

  test("opens the candlestick detail page from the Q1 autocomplete and flags zero-sentinel turnover", async ({ page }) => {
    await page.route("**/api/trading/symbols/search?**", async (route) => {
      await route.fulfill({
        json: {
          query: "005930",
          count: 1,
          items: [
            {
              symbol: "005930",
              standard_code: "KR7005930003",
              name_ko: "Samsung Electronics",
              market: "KOSPI",
            },
          ],
        },
      });
    });
    await page.route("**/api/trading/symbols/005930/price-bars?**", async (route) => {
      await route.fulfill({
        json: {
          symbol: "005930",
          count: 3,
          start_date: "2026-04-10",
          end_date: "2026-04-14",
          requested_start_date: "2025-04-14",
          requested_end_date: "2026-04-14",
          items: [
            {
              trade_date: "2026-04-10",
              open_price: 70000,
              high_price: 71000,
              low_price: 69500,
              close_price: 70500,
              volume: 1000000,
              turnover: 70500000000,
              source: "test",
              captured_at: "2026-04-10T16:00:00+09:00",
            },
            {
              trade_date: "2026-04-13",
              open_price: 70600,
              high_price: 71600,
              low_price: 70200,
              close_price: 70900,
              volume: 1100000,
              turnover: 77990000000,
              source: "test",
              captured_at: "2026-04-13T16:00:00+09:00",
            },
            {
              trade_date: "2026-04-14",
              open_price: 71000,
              high_price: 71800,
              low_price: 70800,
              close_price: 71500,
              volume: 1250000,
              turnover: 0,
              source: "test",
              captured_at: "2026-04-14T16:00:00+09:00",
            },
          ],
        },
      });
    });
    await page.route("**/api/trading/quotes/005930**", async (route) => {
      await route.fulfill({
        json: {
          symbol: "005930",
          company_name: "Samsung Electronics",
          price: 71500,
          change: 600,
          change_pct: 0.84,
          volume: 1250000,
          turnover: 89375000000,
          market_state: "OPEN",
          source: "kis",
          fallback: false,
          is_live: true,
          available: true,
          cached_at: "2026-04-14T09:00:00+09:00",
          trade_date: "2026-04-14",
        },
      });
    });
    await page.route("**/api/trading/market/status", async (route) => {
      await route.fulfill({
        json: {
          state: "OPEN",
          is_open: true,
          server_time: "2026-04-14T09:00:00+09:00",
        },
      });
    });
    await page.route("**/api/trading/eod/freshness", async (route) => {
      await route.fulfill({
        json: {
          today: {
            trade_date: "2026-04-14",
            eod_status: "completed",
            symbols_total: 1,
            symbols_succeeded: 1,
            symbols_failed: 0,
          },
          latest: {
            price_trade_date: "2026-04-14",
            technical_market_date: "2026-04-14",
            action_market_date: "2026-04-14",
          },
          price: {
            success: true,
            latest_date: "2026-04-14",
          },
          technical: {
            success: true,
            latest_date: "2026-04-14",
          },
          action: {
            success: true,
            latest_date: "2026-04-14",
          },
        },
      });
    });

    await page.goto("/search");
    await page.getByLabel(/Search markets, symbols, or analysis/i).fill("005930");

    const resultCard = page.getByRole("link", { name: /005930.*Samsung Electronics/i }).first();
    await expect(resultCard).toBeVisible();
    await expect(resultCard).toHaveAttribute(
      "href",
      /\/dashboard\/symbol\/005930\?.*navContext=search.*q=005930/,
    );

    await expect(resultCard).not.toContainText("₩71,500");
    await expect(resultCard).not.toContainText("+0.84%");

    await Promise.all([page.waitForURL(/\/dashboard\/symbol\/005930/), resultCard.click()]);

    await expect(page.getByRole("heading", { name: /Swipe-aware candlestick chart/i })).toBeVisible();
    await expect(page.getByRole("img", { name: /Historical candlestick chart for 005930/i })).toBeVisible();
    const volumeFocusCard = page.locator("#chart article").filter({ hasText: "Volume" }).first();
    await expect(volumeFocusCard).toContainText("Turnover Check needed");
    await expect(volumeFocusCard).not.toContainText("Turnover ₩0");
  });

  test("uses latest stored market date when Search opens a supported equity on a weekend", async ({ page }) => {
    const latestDate = "2026-05-22";
    const weekendDate = "2026-05-24";

    await page.addInitScript(() => {
      window.localStorage.setItem("trading-web.locale", JSON.stringify("ko"));
    });
    await page.addInitScript((fixedNowIso) => {
      const fixedNow = new Date(fixedNowIso).valueOf();
      const RealDate = Date;
      window.Date = new Proxy(RealDate, {
        apply(target, thisArg, args) {
          return args.length === 0 ? new target(fixedNow).toString() : Reflect.apply(target, thisArg, args);
        },
        construct(target, args) {
          return args.length === 0 ? new target(fixedNow) : Reflect.construct(target, args);
        },
      }) as DateConstructor;
      Date.now = () => fixedNow;
    }, `${weekendDate}T12:30:00+09:00`);
    const priceBarEndDates: Array<string | null> = [];
    const factorMarketDates: Array<string | null> = [];

    await page.route("**/api/trading/symbols/favorites", async (route) => {
      await route.fulfill({ json: { count: 0, items: [] } });
    });
    await page.route("**/api/trading/scanner/tracked-symbols", async (route) => {
      await route.fulfill({
        json: {
          tracked_symbols: [],
          count: 0,
          last_updated_at: null,
        },
      });
    });
    await page.route("**/api/trading/scanner/realtime-trending?**", async (route) => {
      await route.fulfill({
        json: {
          status: "ok",
          source: "kis",
          as_of: `${weekendDate}T12:30:00+09:00`,
          market: "KRX",
          summary: { item_count: 0 },
          items: [],
        },
      });
    });
    await page.route("**/api/trading/scanner/trending-stocks?**", async (route) => {
      await route.fulfill({
        json: {
          request: { resolved_market_date: latestDate },
          summary: { count: 0, data_available: true },
          items: [],
        },
      });
    });
    await page.route("**/api/trading/symbols/search?**", async (route) => {
      const requestUrl = new URL(route.request().url());
      const query = requestUrl.searchParams.get("q") ?? "";

      await route.fulfill({
        json: {
          query,
          count: query ? 1 : 0,
          items: query
            ? [
                {
                  symbol: "005930",
                  standard_code: "KR7005930003",
                  name_ko: "삼성전자",
                  market: "KOSPI",
                  instrument_type: "stock",
                },
              ]
            : [],
        },
      });
    });
    await page.route("**/api/trading/quotes/005930**", async (route) => {
      await route.fulfill({
        json: {
          symbol: "005930",
          company_name: "삼성전자",
          price: null,
          change: null,
          change_pct: null,
          volume: null,
          turnover: null,
          market_state: "WEEKEND",
          source: "daily_price_bar",
          fallback: true,
          is_live: false,
          available: false,
          cached_at: `${weekendDate}T12:30:00+09:00`,
          unavailable_reason: "no_live_quote_or_fresh_fallback",
        },
      });
    });
    await page.route("**/api/trading/market/status", async (route) => {
      await route.fulfill({
        json: {
          state: "WEEKEND",
          is_open: false,
          server_time: `${weekendDate}T12:30:00+09:00`,
          markets: [
            {
              market: "KOSPI",
              state: "WEEKEND",
              is_open: false,
              available: true,
              ready: true,
            },
          ],
        },
      });
    });
    await page.route("**/api/trading/eod/freshness", async (route) => {
      await route.fulfill({
        json: {
          today: {
            trade_date: weekendDate,
            eod_status: "pending",
            symbols_total: 1,
            symbols_succeeded: 0,
            symbols_failed: 0,
          },
          latest: {
            stages: {
              price: {
                summary: {
                  price_trade_date: latestDate,
                },
              },
              technical_snapshots: {
                summary: {
                  market_date: latestDate,
                },
              },
              action_summaries: {
                summary: {
                  market_date: latestDate,
                },
              },
            },
          },
        },
      });
    });
    await page.route("**/api/trading/symbols/005930/price-bars?**", async (route) => {
      const requestUrl = new URL(route.request().url());
      const endDate = requestUrl.searchParams.get("end_date");
      priceBarEndDates.push(endDate);

      await route.fulfill({
        json: {
          symbol: "005930",
          count: endDate === latestDate ? 3 : 0,
          start_date: endDate === latestDate ? "2026-05-20" : null,
          end_date: endDate === latestDate ? latestDate : null,
          requested_start_date: requestUrl.searchParams.get("start_date"),
          requested_end_date: endDate,
          items:
            endDate === latestDate
              ? [
                  {
                    trade_date: "2026-05-20",
                    open_price: 69000,
                    high_price: 70000,
                    low_price: 68800,
                    close_price: 69700,
                    volume: 900000,
                    turnover: 62730000000,
                    source: "test",
                    captured_at: "2026-05-20T16:00:00+09:00",
                  },
                  {
                    trade_date: "2026-05-21",
                    open_price: 69800,
                    high_price: 70700,
                    low_price: 69500,
                    close_price: 70400,
                    volume: 980000,
                    turnover: 68992000000,
                    source: "test",
                    captured_at: "2026-05-21T16:00:00+09:00",
                  },
                  {
                    trade_date: latestDate,
                    open_price: 70500,
                    high_price: 71800,
                    low_price: 70200,
                    close_price: 71500,
                    volume: 1250000,
                    turnover: 89375000000,
                    source: "test",
                    captured_at: `${latestDate}T16:00:00+09:00`,
                  },
                ]
              : [],
        },
      });
    });
    await page.route("**/api/trading/agent-context/symbol-day?**", async (route) => {
      const requestUrl = new URL(route.request().url());
      const marketDate = requestUrl.searchParams.get("market_date") ?? latestDate;

      await route.fulfill({
        json: {
          request: {
            market_date: marketDate,
            symbols: ["005930"],
            fs_div: null,
            fs_label: null,
            disclosures_limit: 4,
          },
          summary: {
            requested_symbol_count: 1,
            matched_symbol_count: 1,
            technical_snapshot_count: 1,
            action_summary_count: 1,
            fundamentals_count: 0,
            recent_disclosure_symbol_count: 0,
            missing_symbols: [],
          },
          items: [
            {
              symbol: "005930",
              market_date: marketDate,
              company: {
                symbol: "005930",
                name_ko: "삼성전자",
                market: "KOSPI",
                instrument_type: "stock",
                standard_code: "KR7005930003",
                source: "test",
                is_active: true,
                last_refreshed_at: null,
                dart: null,
              },
              technical_snapshot: {
                symbol: "005930",
                market_date: marketDate,
                close_price: 71500,
                return_5d: 0.024,
                return_20d: 0.041,
                volume_ratio_20d: 1.12,
                ma_alignment: "bullish",
                trend_state: "uptrend",
                breakout_20d: true,
                breakdown_20d: false,
                source: "test",
                captured_at: `${marketDate}T16:00:00+09:00`,
              },
              action_summary: {
                symbol: "005930",
                market_date: marketDate,
                source: "test",
                action_label: "buy",
                bias_direction: "long",
                signal_score: 82,
                confidence_tier: "high",
                risk_tier: "medium",
                trigger_price: 71600,
                invalidation_price: 69000,
                support_price: 70000,
                resistance_price: 73000,
                reasons: ["latest stored basis"],
                summary_payload: {},
                captured_at: `${marketDate}T16:05:00+09:00`,
              },
              fundamentals: {
                latest_snapshot: null,
                history_summary: {
                  entries: 0,
                  latest_receipt_date: null,
                  latest_period_end_date: null,
                  available_business_years: [],
                  recent_periods: [],
                },
              },
              recent_disclosures: {
                count: 0,
                items: [],
              },
              availability: {
                company: true,
                technical_snapshot: true,
                action_summary: true,
                fundamentals: false,
                recent_disclosures: false,
              },
            },
          ],
        },
      });
    });
    await page.route("**/api/trading/eod/piotroski-filter-results?**", async (route) => {
      await route.fulfill({
        json: {
          market_date: latestDate,
          summary: {
            entries: 1,
            requested_symbol: "005930",
            matched_symbols: ["005930"],
            missing_symbols: [],
            passed_count: 1,
            not_passed_count: 0,
          },
          item: {
            symbol: "005930",
            market_date: latestDate,
            passed_filter: true,
            piotroski_score: 8,
            passes_piotroski_score: true,
            captured_at: `${latestDate}T16:10:00+09:00`,
          },
        },
      });
    });
    await page.route("**/api/trading/eod/momentum-factors?**", async (route) => {
      const marketDate = new URL(route.request().url()).searchParams.get("market_date");
      factorMarketDates.push(marketDate);
      await route.fulfill({
        json: {
          market_date: marketDate,
          feature_version: "momentum_factor_v2",
          summary: { entries: 1, matched_symbols: ["005930"], missing_symbols: [] },
          items: [
            {
              symbol: "005930",
              market_date: marketDate,
              close_price: 71500,
              ma_60: 69000,
              ma_120: 66500,
              momentum_12_1: 0.18,
              return_5d: 0.024,
              has_sufficient_history: false,
              is_price_above_ma120: true,
              is_ma60_above_ma120: true,
              is_recent_overheated: false,
              momentum_rank: 12,
              momentum_percentile: 0.92,
              is_momentum_eligible: false,
              factor_payload: {
                insufficient_history_reason: "requires_at_least_253_stored_trading_bars",
              },
              captured_at: `${marketDate}T16:20:00+09:00`,
            },
          ],
        },
      });
    });
    await page.route("**/api/trading/eod/low-risk-factors?**", async (route) => {
      const marketDate = new URL(route.request().url()).searchParams.get("market_date");
      factorMarketDates.push(marketDate);
      await route.fulfill({
        json: {
          market_date: marketDate,
          feature_version: "low_risk_v1",
          summary: { entries: 1, matched_symbols: ["005930"], missing_symbols: [] },
          item: {
            symbol: "005930",
            market_date: marketDate,
            volatility_60d: 0.12,
            volatility_120d: 0.15,
            max_drawdown_120d: -0.18,
            avg_trading_value_20d: 0,
            volatility_60d_rank: 10,
            volatility_120d_rank: 15,
            max_drawdown_120d_rank: 9,
            liquidity_rank: 180,
            volatility_60d_percentile: 0.91,
            volatility_120d_percentile: 0.88,
            max_drawdown_120d_percentile: 0.9,
            liquidity_percentile: 0.55,
            passes_liquidity_floor: null,
            low_risk_score: 0.71,
            low_risk_classification: "eligible",
            is_low_risk_eligible: true,
            history_days_available: 250,
            factor_payload: {
              metric_statuses: {
                avg_trading_value_20d: "needs_confirmation",
              },
            },
            captured_at: `${marketDate}T16:20:00+09:00`,
          },
        },
      });
    });
    await page.route("**/api/trading/eod/beta-factors?**", async (route) => {
      const marketDate = new URL(route.request().url()).searchParams.get("market_date");
      factorMarketDates.push(marketDate);
      await route.fulfill({
        json: {
          market_date: marketDate,
          feature_version: "beta_v1",
          summary: { entries: 1, matched_symbols: ["005930"], missing_symbols: [] },
          item: {
            symbol: "005930",
            market_date: marketDate,
            benchmark_id: "KOSPI_EQW",
            benchmark_market: "KOSPI",
            beta_60d: 0.78,
            beta_120d: 0.82,
            beta_60d_rank: 22,
            beta_120d_rank: 37,
            beta_60d_percentile: 0.84,
            beta_120d_percentile: 0.76,
            low_beta_score: 0.8,
            low_beta_classification: "eligible",
            is_low_beta_eligible: true,
            history_days_available: 180,
            factor_payload: {},
            captured_at: `${marketDate}T16:20:00+09:00`,
          },
        },
      });
    });
    await page.route("**/api/trading/eod/value-factors?**", async (route) => {
      const marketDate = new URL(route.request().url()).searchParams.get("market_date");
      factorMarketDates.push(marketDate);
      await route.fulfill({
        json: {
          market_date: marketDate,
          feature_version: "value_factor_v1",
          summary: { entries: 1, matched_symbols: ["005930"], missing_symbols: [] },
          item: {
            symbol: "005930",
            market_date: marketDate,
            per: 11.8,
            pbr: 1.24,
            dividend_yield: 0.021,
            per_status: "available",
            pbr_status: "available",
            dividend_yield_status: "available",
            per_rank: 120,
            pbr_rank: 96,
            dividend_yield_rank: 48,
            per_percentile: 0.67,
            pbr_percentile: 0.74,
            dividend_yield_percentile: 0.88,
            value_score: 0.763,
            value_rank: 54,
            value_percentile: 0.86,
            value_status: "scored",
            unified_value_score: 0.812,
            unified_value_rank: 34,
            unified_value_percentile: 0.9,
            unified_value_status: "scored",
            quality_score: null,
            quality_rank: null,
            quality_percentile: null,
            quality_status: "unavailable",
            components_possible: null,
            components_used: null,
            is_quality_score_complete: null,
            quality_component_statuses: {
              roe: "available",
              gross_profit_to_assets: "Missing Depreciation And Amortization",
            },
            factor_payload: {},
            captured_at: `${marketDate}T16:20:00+09:00`,
          },
        },
      });
    });
    await page.route("**/api/trading/eod/advanced-value-factors?**", async (route) => {
      const marketDate = new URL(route.request().url()).searchParams.get("market_date");
      factorMarketDates.push(marketDate);
      await route.fulfill({
        json: {
          market_date: marketDate,
          feature_version: "advanced_value_v1",
          summary: { entries: 1, matched_symbols: ["005930"], missing_symbols: [] },
          item: {
            symbol: "005930",
            market_date: marketDate,
            market_cap_proxy: 120000000000,
            enterprise_value: 150000000000,
            ebitda: 9500000000,
            free_cash_flow: 4200000000,
            fcf_yield: 0.035,
            ev_to_ebitda: 7.2,
            fcf_yield_status: "available",
            ev_to_ebitda_status: "available",
            fcf_yield_valid_for_scoring: true,
            ev_to_ebitda_valid_for_scoring: true,
            fcf_yield_rank: 22,
            ev_to_ebitda_rank: 31,
            fcf_yield_percentile: 0.83,
            ev_to_ebitda_percentile: 0.79,
            advanced_value_score: 0.81,
            advanced_value_rank: 30,
            advanced_value_percentile: 0.88,
            advanced_value_components_used: 2,
            advanced_value_classification: "eligible",
            is_advanced_value_eligible: true,
            factor_payload: {},
            captured_at: `${marketDate}T16:20:00+09:00`,
          },
        },
      });
    });

    await page.goto("/search");
    await page.getByLabel(/마켓, 종목 또는 분석 검색/i).fill("삼성");

    const resultCard = page.getByRole("link", { name: /005930.*삼성전자/ }).first();
    await expect(resultCard).toBeVisible();
    await expect(resultCard).toHaveAttribute("href", /\/dashboard\/symbol\/005930\?.*navContext=search/);

    await Promise.all([page.waitForURL(/\/dashboard\/symbol\/005930/), resultCard.click()]);

    await expect(page).toHaveURL(/\/dashboard\/symbol\/005930/);
    expect(new URL(page.url()).searchParams.get("marketDate")).toBeNull();
    await expect(page.getByText("최신 저장 기준일 2026-05-22 · 현재 2026-05-24 휴장").first()).toBeVisible();
    await expect(page.locator("#summary")).toContainText("최신 호가 소스를 기다리는 중");
    await expect(page.locator("#summary")).not.toContainText("no_live_quote_or_fresh_fallback");
    await expect(page.getByRole("img", { name: /Historical candlestick chart for 005930/i })).toBeVisible();
    await expect(page.locator("#factor-snapshot")).toContainText("5 / 5 팩터 준비됨");
    await expect(page.locator("#factor-snapshot")).toContainText("적용 기준일");
    await expect(page.locator("#factor-snapshot")).toContainText("2026.05.22");
    await expect(page.locator("#factor-snapshot")).toContainText("종합 판단 대기");
    await expect(page.locator("#factor-snapshot")).toContainText("히스토리 부족");
    await expect(page.locator("#factor-snapshot")).toContainText("산출 불가");
    await expect(page.locator("#factor-snapshot")).toContainText("순위 미산출");
    await expect(page.locator("#factor-snapshot")).toContainText("감가상각 데이터 대기");
    await expect(page.locator("#factor-snapshot")).not.toContainText("requires_at_least_253_stored_trading_bars");
    await expect(page.locator("#factor-snapshot")).not.toContainText("Calculation unavailable");
    await expect(page.locator("#factor-snapshot")).not.toContainText("Unavailable");
    await expect(page.locator("#factor-snapshot")).not.toContainText("Unranked");
    await expect(page.locator("#factor-snapshot")).not.toContainText("Missing Depreciation And Amortization");
    await expect(page.locator("#factor-snapshot")).not.toContainText("예약된 슬롯");
    await expect(page.locator("#freshness")).toContainText("2026-05-22");
    expect(priceBarEndDates).toContain(latestDate);
    expect(priceBarEndDates).not.toContain(weekendDate);
    expect(factorMarketDates.length).toBeGreaterThanOrEqual(5);
    expect(factorMarketDates.every((marketDate) => marketDate === latestDate)).toBe(true);
  });

  test("keeps the favorite dialog overlay above the mobile bottom nav", async ({ page }) => {
    await page.route("**/api/trading/symbols/favorites", async (route) => {
      await route.fulfill({
        json: {
          count: 0,
          items: [],
        },
      });
    });
    await page.route("**/api/trading/scanner/tracked-symbols", async (route) => {
      await route.fulfill({
        json: {
          tracked_symbols: [],
          count: 0,
          last_updated_at: "2026-04-14T08:55:00+09:00",
        },
      });
    });
    await page.route("**/api/trading/symbols/search?**", async (route) => {
      await route.fulfill({
        json: {
          query: "",
          count: 0,
          items: [],
        },
      });
    });

    await page.goto("/search");

    await page.getByRole("button", { name: /Open favorite search/i }).click();

    const dialog = page.getByRole("dialog", { name: /Save Symbol/i });
    await expect(dialog).toBeVisible();

    const bottomNav = page.getByRole("navigation", { name: /^Primary$/i });
    await expect(bottomNav).toBeVisible();

    const bottomNavBox = await bottomNav.boundingBox();
    expect(bottomNavBox).not.toBeNull();

    const topLayer = await page.evaluate(
      ({ x, y }) => {
        const element = document.elementFromPoint(x, y);
        const className = typeof element?.className === "string" ? element.className : "";

        return {
          className,
          isWithinBottomNav: Boolean(element?.closest('nav[aria-label="Primary"]')),
          zIndex: element ? Number.parseInt(window.getComputedStyle(element).zIndex, 10) : Number.NaN,
        };
      },
      {
        x: bottomNavBox!.x + bottomNavBox!.width / 2,
        y: bottomNavBox!.y + bottomNavBox!.height / 2,
      },
    );

    expect(topLayer.className).toContain("favoriteDialogOverlay");
    expect(topLayer.isWithinBottomNav).toBe(false);
    expect(topLayer.zIndex).toBeGreaterThan(45);
  });
});
