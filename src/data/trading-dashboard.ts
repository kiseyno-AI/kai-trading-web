export type NavItem = { id: string; label: string; icon: string; href: string; description: string };
export type SearchSuggestion = { label: string; type: string; route: string };
export type Metric = {
  id: string;
  title: string;
  value: string;
  delta: string;
  tone?: "positive" | "neutral";
  subtitle?: string;
  sparkline?: number[];
  donut?: { value: number; summary: string };
};
export type TradeMarker = { type: "buy" | "sell"; label: string; value: string; left: string; top: string };
export type OrderBookRow = { price: string; size: string };
export type BotAction = "start" | "pause" | "hedge" | "stop";
export type WatchItem = { symbol: string; context: string; price: number; change: number };

export type DashboardData = {
  nav: NavItem[];
  searchSuggestions: SearchSuggestion[];
  metrics: Metric[];
  chart: {
    symbol: string;
    title: string;
    tabs: string[];
    overlays: { top: string; mid: string; low: string };
    tradeMarkers: TradeMarker[];
    orderBook: { sell: OrderBookRow[]; midPrice: string; midChange: string; buy: OrderBookRow[] };
  };
  bots: { title: string; idleLabel: string; actions: { id: BotAction; label: string }[] };
  watchlist: WatchItem[];
  insight: {
    score: string;
    label: string;
    title: string;
    description: string;
    rows: { label: string; value: string }[];
  };
};

export const dashboardData: DashboardData = {
  nav: [
    { id: "dashboard", label: "Dashboard", icon: "◫", href: "/dashboard", description: "Main command surface" },
    { id: "portfolio", label: "Assets", icon: "▣", href: "/portfolio", description: "Account state and holdings" },
    { id: "markets", label: "Markets", icon: "◌", href: "/markets", description: "Track market breadth" },
    { id: "bots", label: "Bots", icon: "◎", href: "/bots", description: "Manage automation" },
    { id: "analytics", label: "Analytics", icon: "◭", href: "/dashboard#analytics", description: "Signal overview" },
    { id: "settings", label: "Settings", icon: "⚙", href: "/dashboard#settings", description: "Desk preferences" },
  ],
  searchSuggestions: [
    { label: "BTC/USDT · Perpetual", type: "Market", route: "/markets" },
    { label: "ETH/KRW · Spot", type: "Market", route: "/markets" },
    { label: "Portfolio Assets", type: "Route", route: "/portfolio" },
    { label: "Bots Placeholder", type: "Route", route: "/bots" },
    { label: "SOL/USDT · Watchlist", type: "Market", route: "/dashboard" },
  ],
  metrics: [
    {
      id: "balance",
      title: "Total Balance",
      value: "$4,284,390",
      delta: "+2.48%",
      tone: "positive",
      subtitle: "Across tracked market surfaces",
    },
    {
      id: "pnl",
      title: "Live PNL",
      value: "+$182,440",
      delta: "Realtime",
      tone: "positive",
      subtitle: "Session return +4.21%",
      sparkline: [58, 49, 52, 36, 39, 25, 34, 18, 23, 11, 15],
    },
    {
      id: "winrate",
      title: "Win Rate",
      value: "78%",
      delta: "30D",
      tone: "neutral",
      donut: { value: 78, summary: "214 wins · 101 losses" },
    },
  ],
  chart: {
    symbol: "BTC/USDT",
    title: "Execution Chart",
    tabs: ["1H", "4H", "1D"],
    overlays: { top: "87,880", mid: "87,430", low: "86,980" },
    tradeMarkers: [
      { type: "buy", label: "Buy", value: "87,140", left: "19%", top: "64%" },
      { type: "sell", label: "Sell", value: "87,690", left: "43%", top: "26%" },
      { type: "buy", label: "Buy", value: "87,310", left: "72%", top: "48%" },
    ],
    orderBook: {
      sell: [
        { price: "87,688", size: "1.82 BTC" },
        { price: "87,676", size: "1.14 BTC" },
        { price: "87,661", size: "0.92 BTC" },
      ],
      midPrice: "87,430.18",
      midChange: "+1.8%",
      buy: [
        { price: "87,418", size: "2.03 BTC" },
        { price: "87,401", size: "1.67 BTC" },
        { price: "87,390", size: "1.21 BTC" },
      ],
    },
  },
  bots: {
    title: "Bot controls unavailable",
    idleLabel: "No bot command API connected",
    actions: [],
  },
  watchlist: [
    { symbol: "BTC/USDT", context: "Momentum intact", price: 87430, change: 1.82 },
    { symbol: "ETH/USDT", context: "Testing VWAP", price: 4884, change: -0.44 },
    { symbol: "SOL/USDT", context: "Breakout setup", price: 182.74, change: 3.15 },
    { symbol: "LINK/USDT", context: "Range compression", price: 29.18, change: 0.62 },
  ],
  insight: {
    score: "87 / 100",
    label: "Primary Bias",
    title: "Long continuation with guarded leverage",
    description:
      "Order-flow delta remains positive while short-term funding stays manageable. Watch 87,180 as the invalidation shelf.",
    rows: [
      { label: "Confidence", value: "High" },
      { label: "Volatility", value: "Elevated" },
      { label: "Suggested action", value: "Scale in slowly" },
    ],
  },
};

export const marketSpotlight = [
  { symbol: "BTC/USDT", trend: "Leading the tape", volume: "$12.4B", change: "+1.82%" },
  { symbol: "ETH/USDT", trend: "Retesting value area", volume: "$7.6B", change: "-0.44%" },
  { symbol: "SOL/USDT", trend: "Breakout continuation", volume: "$3.1B", change: "+3.15%" },
];
