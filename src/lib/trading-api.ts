import { botPlaybooks, botStatusMap, dashboardData, marketSpotlight } from "@/data/trading-dashboard";
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
  price: number;
  change: number;
  change_pct: number;
  volume: number;
  turnover: number;
  as_of: string | null;
  market_state: string;
  source: string;
  fallback: boolean;
  is_live: boolean;
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
const formatCompactCurrency = (value: number) => {
  if (value >= 1_000_000_000) return `₩${(value / 1_000_000_000).toFixed(1)}B`;
  if (value >= 1_000_000) return `₩${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `₩${(value / 1_000).toFixed(1)}K`;
  return `₩${value.toLocaleString()}`;
};

async function getJson<T>(baseUrl: string, path: string): Promise<T> {
  const response = await fetch(`${baseUrl}${path}`, {
    headers: {
      Accept: "application/json",
    },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${path}`);
  }

  return (await response.json()) as T;
}

function buildDashboardSnapshotFromCore(
  tracked: CoreTrackedQuotesResponse,
  market: CoreMarketStatus,
  trackedSymbols: CoreTrackedSymbolsResponse,
): DashboardSnapshotDto {
  const items = tracked.items;
  const primary = items[0];
  const totalTurnover = items.reduce((sum, item) => sum + item.turnover, 0);
  const avgChangePct = items.length ? items.reduce((sum, item) => sum + item.change_pct, 0) / items.length : 0;
  const totalVolume = items.reduce((sum, item) => sum + item.volume, 0);

  const watchlist = items.map((item) => ({
    symbol: item.symbol,
    context: item.fallback ? "Cached fallback" : item.is_live ? "Live KRX tracked quote" : `Market ${item.market_state}`,
    price: item.price,
    change: item.change_pct,
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
  };

  return {
    nav: baseNav,
    searchSuggestions: buildSearchSuggestions(trackedSymbols.tracked_symbols),
    metrics: [
      {
        id: "total_balance",
        title: "Tracked Turnover",
        value: formatCompactCurrency(totalTurnover || first.turnover),
        delta: formatSignedPercent(avgChangePct),
        tone: avgChangePct >= 0 ? "positive" : "negative",
        subtitle: `${items.length} tracked symbols · ${market.state} · ${market.server_time}`,
      },
      {
        id: "live_pnl",
        title: "Lead KRX Quote",
        value: `₩${first.price.toLocaleString()}`,
        delta: formatSignedPercent(first.change_pct),
        tone: first.change_pct >= 0 ? "positive" : "negative",
        subtitle: `${first.symbol} · ${formatSignedNumber(first.change)}`,
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
        top: (first.price + Math.max(50, Math.round(first.price * 0.01))).toLocaleString(),
        mid: first.price.toLocaleString(),
        low: Math.max(0, first.price - Math.max(50, Math.round(first.price * 0.01))).toLocaleString(),
      },
      tradeMarkers: [
        { side: "buy", label: "Lead", value: first.price.toLocaleString(), left: "18%", top: "62%" },
        { side: avgChangePct >= 0 ? "sell" : "buy", label: market.state, value: formatSignedPercent(first.change_pct), left: "48%", top: "34%" },
        { side: "buy", label: "Tracked", value: String(trackedSymbols.count), left: "76%", top: "48%" },
      ],
      orderBook: {
        depth: 10,
        sell: [
          { price: (first.price + 30).toLocaleString(), size: "1.20 lot" },
          { price: (first.price + 20).toLocaleString(), size: "0.80 lot" },
          { price: (first.price + 10).toLocaleString(), size: "0.55 lot" },
        ],
        midPrice: first.price.toLocaleString(),
        midChange: formatSignedPercent(first.change_pct),
        buy: [
          { price: Math.max(0, first.price - 10).toLocaleString(), size: "1.14 lot" },
          { price: Math.max(0, first.price - 20).toLocaleString(), size: "0.92 lot" },
          { price: Math.max(0, first.price - 30).toLocaleString(), size: "0.61 lot" },
        ],
      },
    },
    watchlist,
    insight: {
      score: market.is_open ? "82 / 100" : "66 / 100",
      label: "Primary Bias",
      title: market.is_open ? "Live KRX tracked-symbol feed active" : "Market closed, cached tracked view active",
      description: `Source: ${first.source}. Last as-of: ${first.as_of ?? tracked.as_of}. Scanner symbols: ${trackedSymbols.count}.`,
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
      trend: item.fallback ? "Cached quote fallback" : item.is_live ? "Actively tracked" : `State ${item.market_state}`,
      volume: formatCompactCurrency(item.turnover),
      change: formatSignedPercent(item.change_pct),
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
        type: item.type.toLowerCase() === "strategy" ? "bot" : "market",
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

const apiBaseUrl = process.env.NEXT_PUBLIC_TRADING_API_BASE_URL;

const httpTradingApi: TradingApiAdapter = {
  async getDashboardSnapshot() {
    if (!apiBaseUrl) return mockTradingApi.getDashboardSnapshot();

    const [tracked, market, trackedSymbols] = await Promise.all([
      getJson<CoreTrackedQuotesResponse>(apiBaseUrl, "/quotes/tracked"),
      getJson<CoreMarketStatus>(apiBaseUrl, "/market/status"),
      getJson<CoreTrackedSymbolsResponse>(apiBaseUrl, "/scanner/tracked-symbols"),
    ]);

    return envelope(buildDashboardSnapshotFromCore(tracked, market, trackedSymbols), "api");
  },

  async getMarketsOverview() {
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
