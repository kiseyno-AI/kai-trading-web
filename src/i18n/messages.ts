import type { Locale } from "@/types/trading-api";

export const defaultLocale: Locale = "en";

export const messages = {
  en: {
    common: {
      liveFeed: "Live feed",
      placeholderRoute: "Placeholder route",
      readyForApi: "Ready for API wiring",
      maintainableSplit: "Maintainable split",
      notificationsOn: "Notifications On",
      notificationsOff: "Notifications Off",
      alphaDesk: "Alpha Desk",
      quickFind: "Quick find",
      searchPlaceholder: "BTC/USDT, Delta Bot, momentum signal...",
      searchButton: "Search markets, bots, signals",
      noMatches: "No matches found",
    },
    dashboard: {
      title: "Trading Command Surface",
      eyebrow: "Precision & Clarity",
      watchlist: "Watchlist",
      radar: "Radar",
      signalEngine: "Signal Engine",
      aiInsight: "AI Insight",
      automation: "Automation",
      miniOrderBook: "Mini Order Book",
    },
    markets: {
      title: "Markets",
      eyebrow: "Market Surface",
      description:
        "A dedicated route for screening leaders, tracking volume shifts, and plugging in live market data later without bloating the dashboard page.",
      spotlight: "Spotlight",
      priorityPairs: "Priority pairs",
    },
    bots: {
      title: "Bots",
      eyebrow: "Automation Desk",
      description:
        "A focused route for strategy states, allocation controls, and future execution logs. The dashboard can stay lean while automation expands here.",
      playbooks: "Playbooks",
      roster: "Bot roster",
      capital: "capital",
      risk: "Risk",
    },
  },
  ko: {
    common: {
      liveFeed: "실시간 피드",
      placeholderRoute: "준비 중 라우트",
      readyForApi: "API 연동 준비 완료",
      maintainableSplit: "유지보수 가능한 분리",
      notificationsOn: "알림 켜짐",
      notificationsOff: "알림 꺼짐",
      alphaDesk: "알파 데스크",
      quickFind: "빠른 검색",
      searchPlaceholder: "BTC/USDT, 델타 봇, 모멘텀 시그널...",
      searchButton: "마켓, 봇, 시그널 검색",
      noMatches: "일치하는 결과가 없습니다",
    },
    dashboard: {
      title: "트레이딩 커맨드 서피스",
      eyebrow: "정밀함과 명확성",
      watchlist: "워치리스트",
      radar: "레이더",
      signalEngine: "시그널 엔진",
      aiInsight: "AI 인사이트",
      automation: "자동화",
      miniOrderBook: "미니 호가창",
    },
    markets: {
      title: "마켓",
      eyebrow: "마켓 서피스",
      description: "대시보드를 무겁게 만들지 않으면서 핵심 종목 스크리닝과 거래대금 변화 추적, 이후 실시간 데이터 연동까지 확장하기 위한 전용 화면입니다.",
      spotlight: "스포트라이트",
      priorityPairs: "우선 추적 페어",
    },
    bots: {
      title: "봇",
      eyebrow: "자동화 데스크",
      description: "전략 상태, 자본 배분 제어, 향후 체결 로그를 위한 집중 화면입니다. 자동화 기능이 커져도 대시보드는 가볍게 유지합니다.",
      playbooks: "플레이북",
      roster: "봇 로스터",
      capital: "자본",
      risk: "리스크",
    },
  },
} as const;

type KeysToStrings<T> = {
  [K in keyof T]: T[K] extends string ? string : KeysToStrings<T[K]>;
};

export type MessageTree = KeysToStrings<typeof messages.en>;
