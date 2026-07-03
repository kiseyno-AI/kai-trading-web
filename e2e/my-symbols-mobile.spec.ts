import { expect, test, type Page } from "@playwright/test";

import { chromiumIPhone13 } from "./devices";

test.use(chromiumIPhone13);

type MockFavoriteSymbol = {
  symbol: string;
  standard_code: string | null;
  name_ko: string | null;
  market: string | null;
  instrument_type?: string | null;
  is_active?: boolean | null;
  sort_order?: number;
  favorited_at?: string | null;
};

type MockTrackedQuote = {
  symbol: string;
  company_name: string;
  price: number | null;
  change: number | null;
  change_pct: number | null;
  volume: number | null;
  turnover: number | null;
  as_of: string | null;
  market_state: string;
  source: string;
  fallback: boolean;
  is_live: boolean;
  available: boolean;
  trade_date: string | null;
  cached_at: string | null;
  unavailable_reason: string | null;
};

const supportedFavorites: MockFavoriteSymbol[] = [
  {
    symbol: "005930",
    standard_code: "KR7005930003",
    name_ko: "Samsung Electronics",
    market: "KOSPI",
    instrument_type: "stock",
  },
  {
    symbol: "000660",
    standard_code: "KR7000660001",
    name_ko: "SK hynix",
    market: "KOSPI",
    instrument_type: "stock",
  },
];

const supportedTrackedQuotes: MockTrackedQuote[] = [
  {
    symbol: "005930",
    company_name: "Samsung Electronics",
    price: 71500,
    change: 700,
    change_pct: 0.99,
    volume: 120000,
    turnover: 8580000000,
    as_of: "2026-04-21T09:12:00+09:00",
    market_state: "OPEN",
    source: "kis",
    fallback: false,
    is_live: true,
    available: true,
    trade_date: "2026-04-21",
    cached_at: "2026-04-21T09:12:00+09:00",
    unavailable_reason: null,
  },
  {
    symbol: "000660",
    company_name: "SK hynix",
    price: 183400,
    change: -1200,
    change_pct: -0.65,
    volume: 94000,
    turnover: 17239600000,
    as_of: "2026-04-21T09:12:00+09:00",
    market_state: "OPEN",
    source: "db_cache",
    fallback: true,
    is_live: false,
    available: true,
    trade_date: "2026-04-21",
    cached_at: "2026-04-21T09:12:00+09:00",
    unavailable_reason: null,
  },
];

async function mockMobileToolbarApis(
  page: Page,
  options: {
    favorites?: MockFavoriteSymbol[];
    trackedQuotes?: MockTrackedQuote[];
    onTrackedSymbolsPost?: (symbols: string[]) => void;
  } = {},
) {
  const favorites = options.favorites ?? supportedFavorites;
  const trackedQuotes = options.trackedQuotes ?? supportedTrackedQuotes;
  let trackedSymbols = trackedQuotes.map((item) => item.symbol);

  await page.route("**/api/trading/market/status", async (route) => {
    await route.fulfill({
      json: {
        state: "OPEN",
        is_open: true,
        server_time: "2026-04-21T09:12:00+09:00",
      },
    });
  });
  await page.route("**/api/trading/symbols/favorites", async (route) => {
    await route.fulfill({
      json: {
        count: favorites.length,
        items: favorites,
      },
    });
  });
  await page.route("**/api/trading/scanner/tracked-symbols", async (route) => {
    if (route.request().method() === "POST") {
      const payload = JSON.parse(route.request().postData() ?? "{}") as { symbols?: string[] };
      trackedSymbols = Array.isArray(payload.symbols) ? payload.symbols : [];
      options.onTrackedSymbolsPost?.(trackedSymbols);
      await route.fulfill({
        json: {
          tracked_symbols: trackedSymbols,
          count: trackedSymbols.length,
          last_updated_at: "2026-04-21T09:13:00+09:00",
        },
      });
      return;
    }

    await route.fulfill({
      json: {
        tracked_symbols: trackedSymbols,
        count: trackedSymbols.length,
        last_updated_at: "2026-04-21T09:12:00+09:00",
      },
    });
  });
  await page.route("**/api/trading/symbols/search?**", async (route) => {
    const requestUrl = new URL(route.request().url());
    const query = requestUrl.searchParams.get("q") ?? "";

    await route.fulfill({
      json: {
        query,
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
        as_of: "2026-04-21T09:12:00+09:00",
        market: "KRX",
        summary: {
          item_count: 0,
        },
        items: [],
      },
    });
  });
  await page.route("**/api/trading/quotes/tracked", async (route) => {
    await route.fulfill({
      json: {
        market_state: "OPEN",
        as_of: "2026-04-21T09:12:00+09:00",
        items: trackedQuotes,
      },
    });
  });
}

test.describe("my symbols mobile flow", () => {
  test("bottom toolbar opens the full My Symbols screen instead of the dashboard section anchor", async ({ page }) => {
    await mockMobileToolbarApis(page);

    await page.goto("/search");

    await expect(page.getByRole("heading", { name: "Quick Access" })).toBeVisible();
    await page.getByRole("link", { name: "My Symbols", exact: true }).click();

    await expect(page).toHaveURL(/\/my-symbols$/);
    await expect(page.getByRole("heading", { name: "My Symbols" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Universal Search" })).toHaveCount(0);
    await expect(page.getByText("Samsung Electronics").first()).toBeVisible();
    await expect(page.getByText("SK hynix").first()).toBeVisible();
    await expect(page.getByText("Full tracked list")).toBeVisible();
    await expect(page.getByText("Core favorite").first()).toBeVisible();

    const samsungSymbolLink = page.locator('a[href^="/dashboard/symbol/005930"]').first();
    await expect(samsungSymbolLink).toHaveAttribute("href", /navContext=my-symbols/);
    await samsungSymbolLink.click();

    await expect(page).toHaveURL(/\/dashboard\/symbol\/005930\?.*navContext=my-symbols/);
    await expect(page.getByRole("heading", { name: "Samsung Electronics" })).toBeVisible();

    const mySymbolsNavItem = page.getByRole("link", { name: "My Symbols", exact: true });
    await expect(mySymbolsNavItem).toHaveAttribute("aria-current", "page");
    await expect(mySymbolsNavItem).toHaveClass(/navItemActive/);
  });

  test("marks summary counts unavailable when tracked and favorite feeds fail", async ({ page }) => {
    await page.addInitScript(() => {
      const now = Date.now();
      const staleTrackedQuotes = {
        market_state: "OPEN",
        as_of: "2026-04-21T09:12:00+09:00",
        items: [
          {
            symbol: "005930",
            company_name: "Samsung Electronics",
            price: 71500,
            change: 700,
            change_pct: 0.99,
            volume: 120000,
            turnover: 8580000000,
            as_of: "2026-04-21T09:12:00+09:00",
            market_state: "OPEN",
            source: "kis",
            fallback: false,
            is_live: true,
            available: true,
            trade_date: "2026-04-21",
            cached_at: "2026-04-21T09:12:00+09:00",
            unavailable_reason: null,
          },
          {
            symbol: "000660",
            company_name: "SK hynix",
            price: 183400,
            change: -1200,
            change_pct: -0.65,
            volume: 94000,
            turnover: 17239600000,
            as_of: "2026-04-21T09:12:00+09:00",
            market_state: "OPEN",
            source: "db_cache",
            fallback: true,
            is_live: false,
            available: true,
            trade_date: "2026-04-21",
            cached_at: "2026-04-21T09:12:00+09:00",
            unavailable_reason: null,
          },
          {
            symbol: "035420",
            company_name: "NAVER",
            price: 211000,
            change: 0,
            change_pct: 0,
            volume: 64000,
            turnover: 13504000000,
            as_of: "2026-04-21T09:12:00+09:00",
            market_state: "OPEN",
            source: "kis",
            fallback: false,
            is_live: true,
            available: true,
            trade_date: "2026-04-21",
            cached_at: "2026-04-21T09:12:00+09:00",
            unavailable_reason: null,
          },
          {
            symbol: "051910",
            company_name: "LG Chem",
            price: null,
            change: null,
            change_pct: null,
            volume: null,
            turnover: null,
            as_of: null,
            market_state: "UNKNOWN",
            source: "kis",
            fallback: false,
            is_live: false,
            available: false,
            trade_date: null,
            cached_at: null,
            unavailable_reason: "timeout",
          },
        ],
      };

      window.sessionStorage.setItem(
        "kai.trading-api.cache.v1",
        JSON.stringify({
          "SNAPSHOT GET /api/trading/quotes/tracked": {
            cachedAt: now,
            expiresAt: now + 60_000,
            data: staleTrackedQuotes,
          },
        }),
      );
    });
    await page.route("**/api/trading/market/status", async (route) => {
      await route.fulfill({
        json: {
          state: "OPEN",
          is_open: true,
          server_time: "2026-04-21T09:12:00+09:00",
        },
      });
    });
    await page.route("**/api/trading/symbols/favorites", async (route) => {
      await route.fulfill({ status: 504, json: { error: "favorites unavailable" } });
    });
    await page.route("**/api/trading/quotes/tracked", async (route) => {
      await route.fulfill({ status: 504, json: { error: "tracked unavailable" } });
    });
    await page.route("**/api/trading/scanner/tracked-symbols", async (route) => {
      await route.fulfill({ json: { tracked_symbols: [], count: 0, last_updated_at: null } });
    });
    await page.route("**/api/trading/scanner/realtime-trending?**", async (route) => {
      await route.fulfill({
        json: {
          status: "ok",
          source: "kis",
          as_of: "2026-04-21T09:12:00+09:00",
          market: "KRX",
          summary: {
            item_count: 0,
          },
          items: [],
        },
      });
    });

    await page.goto("/my-symbols");

    const hero = page.locator("section").filter({ has: page.getByRole("heading", { name: "My Symbols" }) }).first();
    const trackedSection = page.locator("section").filter({ has: page.getByRole("heading", { name: "Full tracked list" }) });

    await expect(page.getByText("Tracked symbols unavailable.")).toBeVisible();
    await expect(page.getByText("Favorite symbols unavailable.")).toBeVisible();
    await expect(page.getByText("HTTP 504")).toHaveCount(0);
    await expect(hero.getByText("Count unavailable")).toHaveCount(2);
    await expect(trackedSection.getByText("Count unavailable")).toBeVisible();
    await expect(hero.getByText("4", { exact: true })).toHaveCount(0);
    await expect(hero.getByText("3 currently available")).toHaveCount(0);
    await expect(trackedSection.getByText("4 tracked")).toHaveCount(0);
  });

  test("removes unsupported favorites without exposing a symbol detail shortcut", async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem("trading-web.locale", JSON.stringify("ko"));
    });
    let postedSymbols: string[] | null = null;
    await mockMobileToolbarApis(page, {
      favorites: [
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
      trackedQuotes: [
        {
          symbol: "F70100026",
          company_name: "한투글로벌넥스트웨이브1(A)",
          price: null,
          change: null,
          change_pct: null,
          volume: null,
          turnover: null,
          as_of: null,
          market_state: "UNKNOWN",
          source: "fund",
          fallback: true,
          is_live: false,
          available: false,
          trade_date: null,
          cached_at: null,
          unavailable_reason: "unsupported instrument",
        },
      ],
      onTrackedSymbolsPost: (symbols) => {
        postedSymbols = symbols;
      },
    });

    await page.goto("/my-symbols");

    await expect(page.getByRole("heading", { name: "내 종목" })).toBeVisible();

    const favoriteSection = page.locator("section").filter({ has: page.getByRole("heading", { name: "고정 종목" }) });
    const unsupportedFavorite = favoriteSection.getByRole("group", { name: /F70100026.*지원 제한/ });
    await expect(unsupportedFavorite).toBeVisible();
    await expect(unsupportedFavorite).toContainText("지원 제한");
    await expect(unsupportedFavorite).toContainText("주식 상세 커버리지 밖");
    await expect(page.getByRole("group", { name: /F70100026.*지원 제한/ })).toHaveCount(2);
    await expect(page.getByRole("link", { name: /F70100026/ })).toHaveCount(0);
    await expect(page.locator('a[href*="/dashboard/symbol/F70100026"]')).toHaveCount(0);

    const removeFavorite = unsupportedFavorite.getByRole("button", {
      name: /즐겨찾기 제거 F70100026/,
    });
    await expect(removeFavorite).toBeVisible();
    await removeFavorite.click();

    await expect.poll(() => postedSymbols).toEqual([]);
    await expect(page.getByRole("group", { name: /F70100026.*지원 제한/ })).toHaveCount(0);
    await expect(favoriteSection.getByText("저장된 즐겨찾기가 없습니다.")).toBeVisible();
    await expect(page.getByText("아직 추적 중인 종목이 없습니다.")).toBeVisible();
    await expect(favoriteSection.getByText("F70100026 내 종목에서 제거되었습니다.")).toBeVisible();
    await expect(page).toHaveURL(/\/my-symbols$/);
  });

  test("dashboard navigation keeps loading feedback local to the toolbar and avoids any full-page loader", async ({
    page,
  }) => {
    await mockMobileToolbarApis(page);
    await page.route("**/dashboard", async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 250));
      await route.continue();
    });
    await page.route("**/dashboard?*", async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 250));
      await route.continue();
    });

    await page.goto("/search");
    await expect(page.getByRole("heading", { name: "Quick Access" })).toBeVisible();

    await page.evaluate(() => {
      const state = window as Window & {
        __dashboardNavPendingSeen?: boolean;
        __globalLoaderSeen?: boolean;
        __navigationUxObserver?: MutationObserver;
      };
      const fullPageLoaderSelector =
        '[role="status"][aria-label="Loading symbol workspace"], [role="status"][aria-label="Loading next surface"]';
      const dashboardNavSelector = 'a[href="/dashboard"][aria-busy="true"]';
      const markLoadingSignals = () => {
        if (document.querySelector(fullPageLoaderSelector)) {
          state.__globalLoaderSeen = true;
        }
        if (document.querySelector(dashboardNavSelector)) {
          state.__dashboardNavPendingSeen = true;
        }
      };

      state.__dashboardNavPendingSeen = false;
      state.__globalLoaderSeen = false;
      state.__navigationUxObserver?.disconnect();
      state.__navigationUxObserver = new MutationObserver(markLoadingSignals);
      state.__navigationUxObserver.observe(document.body, {
        attributes: true,
        attributeFilter: ["aria-busy", "aria-label", "role", "href"],
        childList: true,
        subtree: true,
      });
      markLoadingSignals();
    });

    const dashboardLink = page.getByRole("link", { name: "Dashboard", exact: true });
    await dashboardLink.click();

    await expect.poll(() => page.evaluate(() => (window as Window & { __dashboardNavPendingSeen?: boolean }).__dashboardNavPendingSeen ?? false)).toBe(true);
    await expect(page).toHaveURL(/\/dashboard$/, { timeout: 15_000 });
    await expect(page.getByRole("heading", { name: /Decider, portfolio, and market state/i })).toHaveCount(0);
    await expect(page.getByRole("heading", { name: /Decider recommendations/i })).toBeVisible();
    await expect(page.getByRole("status", { name: /Loading symbol workspace|Loading next surface/i })).toHaveCount(0);
    await expect.poll(() => page.evaluate(() => (window as Window & { __globalLoaderSeen?: boolean }).__globalLoaderSeen ?? false)).toBe(false);

    await page.goBack();

    await expect(page).toHaveURL(/\/search$/);
    await expect(page.getByRole("heading", { name: "Quick Access" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Dashboard", exact: true })).toHaveAttribute("data-navigation-pending", "false");
    await expect(page.getByRole("link", { name: "Dashboard", exact: true })).not.toHaveAttribute("aria-busy", "true");
  });
});
