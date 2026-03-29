export type Locale = "en" | "ko";

export type ApiEnvelope<T> = {
  data: T;
  meta: {
    generatedAt: string;
    source: "mock" | "api";
    requestId?: string;
  };
};

export type NavItemDto = {
  id: string;
  label: string;
  icon: string;
  href: string;
  description: string;
};

export type SearchSuggestionDto = {
  id: string;
  label: string;
  type: "market" | "bot" | "signal" | "route";
  route: string;
};

export type MetricDto = {
  id: "total_balance" | "live_pnl" | "win_rate";
  title: string;
  value: string;
  delta: string;
  tone?: "positive" | "neutral" | "negative";
  subtitle?: string;
  sparkline?: number[];
  donut?: { value: number; summary: string };
};

export type OrderBookLevelDto = {
  price: string;
  size: string;
};

export type TradeMarkerDto = {
  side: "buy" | "sell";
  label: string;
  value: string;
  left: string;
  top: string;
};

export type ChartSnapshotDto = {
  symbol: string;
  title: string;
  tabs: string[];
  activeTab: string;
  overlays: { top: string; mid: string; low: string };
  tradeMarkers: TradeMarkerDto[];
  orderBook: {
    depth: number;
    sell: OrderBookLevelDto[];
    midPrice: string;
    midChange: string;
    buy: OrderBookLevelDto[];
  };
};

export type WatchItemDto = {
  symbol: string;
  context: string;
  price: number;
  change: number;
};

export type InsightRowDto = {
  label: string;
  value: string;
};

export type InsightDto = {
  score: string;
  label: string;
  title: string;
  description: string;
  rows: InsightRowDto[];
};

export type DashboardSnapshotDto = {
  nav: NavItemDto[];
  searchSuggestions: SearchSuggestionDto[];
  metrics: MetricDto[];
  chart: ChartSnapshotDto;
  watchlist: WatchItemDto[];
  insight: InsightDto;
  botControls: {
    title: string;
    idleLabel: string;
    actions: Array<{ id: BotCommand; label: string }>;
  };
};

export type MarketSpotlightDto = {
  symbol: string;
  trend: string;
  volume: string;
  change: string;
};

export type MarketsOverviewDto = {
  spotlight: MarketSpotlightDto[];
};

export type BotStatus = "idle" | "running" | "paused" | "hedged" | "stopped";
export type BotCommand = "start" | "pause" | "hedge" | "stop";

export type BotSummaryDto = {
  id: string;
  name: string;
  mode: string;
  risk: string;
  allocation: string;
  status: BotStatus;
};

export type BotsOverviewDto = {
  bots: BotSummaryDto[];
};

export type BotCommandRequestDto = {
  command: BotCommand;
  note?: string;
};

export type BotCommandResponseDto = {
  botId: string;
  command: BotCommand;
  status: BotStatus;
  statusLabel: string;
  acceptedAt: string;
};

export type TradingApiAdapter = {
  getDashboardSnapshot: () => Promise<ApiEnvelope<DashboardSnapshotDto>>;
  getMarketsOverview: () => Promise<ApiEnvelope<MarketsOverviewDto>>;
  getBotsOverview: () => Promise<ApiEnvelope<BotsOverviewDto>>;
  sendBotCommand: (botId: string, request: BotCommandRequestDto) => Promise<ApiEnvelope<BotCommandResponseDto>>;
};
