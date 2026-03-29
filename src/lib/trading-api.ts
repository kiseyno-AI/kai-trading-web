import { botPlaybooks, botStatusMap, dashboardData, marketSpotlight } from "@/data/trading-dashboard";
import type {
  ApiEnvelope,
  BotCommandRequestDto,
  BotCommandResponseDto,
  BotStatus,
  BotsOverviewDto,
  DashboardSnapshotDto,
  MarketsOverviewDto,
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

export const mockTradingApi: TradingApiAdapter = {
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

export const tradingApi = mockTradingApi;
