import { botPlaybooks, botStatusMap, dashboardData, marketSpotlight } from "@/data/trading-dashboard";
import { startWebDiagnosticSpan } from "@/lib/web-diagnostics";
import type {
  ApiEnvelope,
  BotCommandRequestDto,
  BotCommandResponseDto,
  BotStatus,
  BotsOverviewDto,
  DashboardSnapshotDto,
  MarketsOverviewDto,
  NavItemDto,
  SearchSuggestionDto,
  TradingApiAdapter,
} from "@/types/trading-api";

function envelope<T>(data: T, source: "mock" | "api" = "mock"): ApiEnvelope<T> {
  return {
    data,
    meta: {
      generatedAt: new Date().toISOString(),
      source,
    },
  };
}

function trimTrailingSlash(value: string) {
  return value.endsWith("/") ? value.slice(0, -1) : value;
}

function isLocalHostname(hostname: string) {
  return hostname === "localhost" || hostname === "127.0.0.1";
}

const commandToStatus: Record<BotCommandRequestDto["command"], BotStatus> = {
  start: "running",
  pause: "paused",
  hedge: "hedged",
  stop: "stopped",
};

type CoreMarketStatus = {
  state: string;
  is_open: boolean;
  server_time: string;
};

type CoreTrackedQuote = {
  symbol: string;
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
  trade_date?: string | null;
  fallback_reason?: string | null;
  unavailable_reason?: string | null;
};

type CoreTrackedQuotesResponse = {
  market_state: string;
  as_of: string;
  items: CoreTrackedQuote[];
};

type CoreTrackedSymbolsResponse = {
  tracked_symbols: string[];
  count: number;
  last_updated_at: string | null;
};

const baseNav: NavItemDto[] = [
  { id: "dashboard", label: "Dashboard", icon: "◫", href: "/dashboard", description: "Main command surface" },
  { id: "search", label: "Search", icon: "⌕", href: "/search", description: "Find symbols by name or code" },
  { id: "portfolio", label: "Assets", icon: "▣", href: "/portfolio", description: "Account state and holdings" },
  { id: "markets", label: "Markets", icon: "◌", href: "/markets", description: "Track market breadth" },
  { id: "bots", label: "Bots", icon: "◎", href: "/bots", description: "Manage automation" },
  { id: "analytics", label: "Analytics", icon: "◭", href: "/dashboard#analytics", description: "Signal overview" },
  { id: "settings", label: "Settings", icon: "⚙", href: "/dashboard#settings", description: "Desk preferences" },
];

const baseBotControls = {
  title: "Bot Controls",
  idleLabel: "Bot idle · Awaiting command",
  actions: [
    { id: "start" as const, label: "Start Bot" },
    { id: "pause" as const, label: "Pause" },
    { id: "hedge" as const, label: "Hedge" },
    { id: "stop" as const, label: "Stop" },
  ],
};

const buildSearchSuggestions = (symbols: string[]): SearchSuggestionDto[] =>
  symbols.map((symbol, index) => ({
    id: `market-${index + 1}`,
    label: `${symbol} · KRX tracked`,
    type: "market",
    route: "/markets",
  }));

const formatSignedPercent = (value: number) => `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
const formatSignedNumber = (value: number) => `${value >= 0 ? "+" : ""}${value.toLocaleString()}`;
const hasNumber = (value: number | null | undefined): value is number => typeof value === "number";
const formatSignedPercentSafe = (value: number | null | undefined, fallback = "Unavailable") =>
  hasNumber(value) ? formatSignedPercent(value) : fallback;
const formatCompactCurrency = (value: number) => {
  if (value >= 1_000_000_000) return `₩${(value / 1_000_000_000).toFixed(1)}B`;
  if (value >= 1_000_000) return `₩${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `₩${(value / 1_000).toFixed(1)}K`;
  return `₩${value.toLocaleString()}`;
};

async function getJson<T>(baseUrl: string, path: string): Promise<T> {
  const url = `${baseUrl}${path}`;
  const span = startWebDiagnosticSpan("http", "request", {
    method: "GET",
    path: url,
    scope: "client-adapter",
  });

  try {
    const response = await fetch(url, {
      headers: {
        Accept: "application/json",
      },
      cache: "no-store",
    });

    span.end({
      method: "GET",
      ok: response.ok,
      path: response.url || url,
      scope: "client-adapter",
      status: response.status,
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status} for ${path}`);
    }

    return (await response.json()) as T;
  } catch (error) {
    span.fail(error, {
      method: "GET",
      path: url,
      scope: "client-adapter",
    });
    throw error;
  }
}

function buildDashboardSnapshotFromCore(
  tracked: CoreTrackedQuotesResponse,
  market: CoreMarketStatus,
  trackedSymbols: CoreTrackedSymbolsResponse,
): DashboardSnapshotDto {
  const items = tracked.items.filter((item) => item.available);
  const primary = items[0];
  const totalTurnover = items.reduce((sum, item) => sum + (item.turnover ?? 0), 0);
  const avgChangePct = items.length ? items.reduce((sum, item) => sum + (item.change_pct ?? 0), 0) / items.length : 0;
  const totalVolume = items.reduce((sum, item) => sum + (item.volume ?? 0), 0);

  const watchlist = tracked.items.map((item) => ({
    symbol: item.symbol,
    context: !item.available
      ? `Unavailable${item.unavailable_reason ? ` · ${item.unavailable_reason}` : ""}`
      : item.source === "daily_price_bar"
        ? `DB EOD fallback${item.trade_date ? ` · ${item.trade_date}` : ""}`
        : item.fallback
          ? "Fallback quote"
          : item.is_live
            ? "Live KRX tracked quote"
            : `Market ${item.market_state}`,
    price: item.available ? item.price : null,
    change: item.available ? item.change_pct : null,
    available: item.available,
  }));

  const first = primary ?? {
    symbol: trackedSymbols.tracked_symbols[0] ?? "005930",
    price: 0,
    change: 0,
    change_pct: 0,
    volume: 0,
    turnover: 0,
    as_of: null,
    market_state: tracked.market_state,
    source: "api",
    fallback: false,
    is_live: market.is_open,
    available: market.is_open,
  };
  const firstPrice = first.price ?? 0;
  const firstChange = first.change ?? 0;
  const firstChangePct = first.change_pct ?? 0;

  return {
    nav: baseNav,
    searchSuggestions: buildSearchSuggestions(trackedSymbols.tracked_symbols),
    metrics: [
      {
        id: "total_balance",
        title: "Tracked Turnover",
        value: formatCompactCurrency(totalTurnover || first.turnover || 0),
        delta: formatSignedPercent(avgChangePct),
        tone: avgChangePct >= 0 ? "positive" : "negative",
        subtitle: `${items.length} tracked symbols · ${market.state} · ${market.server_time}`,
      },
      {
        id: "live_pnl",
        title: "Lead KRX Quote",
        value: `₩${firstPrice.toLocaleString()}`,
        delta: formatSignedPercent(firstChangePct),
        tone: firstChangePct >= 0 ? "positive" : "negative",
        subtitle: `${first.symbol} · ${formatSignedNumber(firstChange)}`,
        sparkline: [58, 49, 52, 36, 39, 25, 34, 18, 23, 11, 15],
      },
      {
        id: "win_rate",
        title: "Tracked Breadth",
        value: `${Math.max(0, Math.min(100, Math.round(50 + avgChangePct * 8)))}%`,
        delta: market.is_open ? "Open" : "Closed",
        tone: "neutral",
        donut: {
          value: Math.max(0, Math.min(100, Math.round(50 + avgChangePct * 8))),
          summary: `Tracked volume ${totalVolume.toLocaleString()}`,
        },
      },
    ],
    chart: {
      symbol: first.symbol,
      title: "KRX Tracked Execution View",
      tabs: ["1H", "4H", "1D"],
      activeTab: "1H",
      overlays: {
        top: (firstPrice + Math.max(50, Math.round(firstPrice * 0.01))).toLocaleString(),
        mid: firstPrice.toLocaleString(),
        low: Math.max(0, firstPrice - Math.max(50, Math.round(firstPrice * 0.01))).toLocaleString(),
      },
      tradeMarkers: [
        { side: "buy", label: "Lead", value: firstPrice.toLocaleString(), left: "18%", top: "62%" },
        { side: avgChangePct >= 0 ? "sell" : "buy", label: market.state, value: formatSignedPercent(firstChangePct), left: "48%", top: "34%" },
        { side: "buy", label: "Tracked", value: String(trackedSymbols.count), left: "76%", top: "48%" },
      ],
      orderBook: {
        depth: 10,
        sell: [
          { price: (firstPrice + 30).toLocaleString(), size: "1.20 lot" },
          { price: (firstPrice + 20).toLocaleString(), size: "0.80 lot" },
          { price: (firstPrice + 10).toLocaleString(), size: "0.55 lot" },
        ],
        midPrice: firstPrice.toLocaleString(),
        midChange: formatSignedPercent(firstChangePct),
        buy: [
          { price: Math.max(0, firstPrice - 10).toLocaleString(), size: "1.14 lot" },
          { price: Math.max(0, firstPrice - 20).toLocaleString(), size: "0.92 lot" },
          { price: Math.max(0, firstPrice - 30).toLocaleString(), size: "0.61 lot" },
        ],
      },
    },
    watchlist,
    insight: {
      score: market.is_open ? "82 / 100" : "66 / 100",
      label: "Primary Bias",
      title: market.is_open ? "Live KRX tracked-symbol feed active" : "Tracked quote fallback policy active",
      description: `Source: ${first.source}. Last as-of: ${first.as_of ?? first.trade_date ?? tracked.as_of}. Scanner symbols: ${trackedSymbols.count}.`,
      rows: [
        { label: "Market state", value: market.state },
        { label: "Tracked symbols", value: String(trackedSymbols.count) },
        { label: "Lead symbol", value: first.symbol },
      ],
    },
    botControls: baseBotControls,
  };
}

function buildMarketsOverviewFromCore(tracked: CoreTrackedQuotesResponse): MarketsOverviewDto {
  return {
    spotlight: tracked.items.map((item) => ({
      symbol: item.symbol,
      trend: !item.available
        ? `Quote unavailable${item.unavailable_reason ? ` · ${item.unavailable_reason}` : ""}`
        : item.source === "daily_price_bar"
          ? `DB EOD fallback${item.trade_date ? ` · ${item.trade_date}` : ""}`
          : item.fallback
            ? "Fallback quote"
            : item.is_live
              ? "Actively tracked"
              : `State ${item.market_state}`,
      volume: hasNumber(item.turnover) ? formatCompactCurrency(item.turnover) : "Unavailable",
      change: formatSignedPercentSafe(item.change_pct),
    })),
  };
}

const mockTradingApi: TradingApiAdapter = {
  async getDashboardSnapshot() {
    const snapshot: DashboardSnapshotDto = {
      nav: dashboardData.nav,
      searchSuggestions: dashboardData.searchSuggestions.map((item, index) => ({
        id: `${item.type.toLowerCase()}-${index + 1}`,
        label: item.label,
        type: item.type.toLowerCase() === "strategy" ? "bot" : item.type.toLowerCase() === "route" ? "route" : "market",
        route: item.route,
      })),
      metrics: dashboardData.metrics.map((metric) => ({
        id: metric.id === "balance" ? "total_balance" : metric.id === "pnl" ? "live_pnl" : "win_rate",
        title: metric.title,
        value: metric.value,
        delta: metric.delta,
        tone: metric.tone,
        subtitle: metric.subtitle,
        sparkline: metric.sparkline,
        donut: metric.donut,
      })),
      chart: {
        symbol: dashboardData.chart.symbol,
        title: dashboardData.chart.title,
        tabs: dashboardData.chart.tabs,
        activeTab: dashboardData.chart.tabs[0],
        overlays: dashboardData.chart.overlays,
        tradeMarkers: dashboardData.chart.tradeMarkers.map((marker) => ({
          side: marker.type,
          label: marker.label,
          value: marker.value,
          left: marker.left,
          top: marker.top,
        })),
        orderBook: {
          depth: 10,
          sell: dashboardData.chart.orderBook.sell,
          midPrice: dashboardData.chart.orderBook.midPrice,
          midChange: dashboardData.chart.orderBook.midChange,
          buy: dashboardData.chart.orderBook.buy,
        },
      },
      watchlist: dashboardData.watchlist,
      insight: dashboardData.insight,
      botControls: dashboardData.bots,
    };

    return envelope(snapshot);
  },

  async getMarketsOverview() {
    const overview: MarketsOverviewDto = {
      spotlight: marketSpotlight,
    };

    return envelope(overview);
  },

  async getBotsOverview() {
    const overview: BotsOverviewDto = {
      bots: botPlaybooks.map((bot, index) => ({
        id: `bot-${index + 1}`,
        name: bot.name,
        mode: bot.mode,
        risk: bot.risk,
        allocation: bot.allocation,
        status: bot.mode === "Armed" ? "running" : bot.mode === "Standby" ? "idle" : "paused",
      })),
    };

    return envelope(overview);
  },

  async sendBotCommand(botId, request) {
    const status = commandToStatus[request.command];
    const response: BotCommandResponseDto = {
      botId,
      command: request.command,
      status,
      statusLabel: botStatusMap[request.command],
      acceptedAt: new Date().toISOString(),
    };

    return envelope(response);
  },
};

function getBrowserTradingApiBaseUrl() {
  const configuredBaseUrl = process.env.NEXT_PUBLIC_TRADING_API_BASE_URL;
  if (configuredBaseUrl) {
    return trimTrailingSlash(configuredBaseUrl);
  }

  if (typeof window !== "undefined" && !isLocalHostname(window.location.hostname)) {
    return process.env.NEXT_PUBLIC_TRADING_API_BASE_URL || "/api/trading";
  }

  return null;
}

const httpTradingApi: TradingApiAdapter = {
  async getDashboardSnapshot() {
    const apiBaseUrl = getBrowserTradingApiBaseUrl();
    if (!apiBaseUrl) return mockTradingApi.getDashboardSnapshot();

    const [tracked, market, trackedSymbols] = await Promise.all([
      getJson<CoreTrackedQuotesResponse>(apiBaseUrl, "/quotes/tracked"),
      getJson<CoreMarketStatus>(apiBaseUrl, "/market/status"),
      getJson<CoreTrackedSymbolsResponse>(apiBaseUrl, "/scanner/tracked-symbols"),
    ]);

    return envelope(buildDashboardSnapshotFromCore(tracked, market, trackedSymbols), "api");
  },

  async getMarketsOverview() {
    const apiBaseUrl = getBrowserTradingApiBaseUrl();
    if (!apiBaseUrl) return mockTradingApi.getMarketsOverview();

    const tracked = await getJson<CoreTrackedQuotesResponse>(apiBaseUrl, "/quotes/tracked");
    return envelope(buildMarketsOverviewFromCore(tracked), "api");
  },

  async getBotsOverview() {
    return mockTradingApi.getBotsOverview();
  },

  async sendBotCommand(botId, request) {
    return mockTradingApi.sendBotCommand(botId, request);
  },
};

export const tradingApi = httpTradingApi;
