"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

import { defaultLocale, messages, type MessageTree } from "@/i18n/messages";
import { readStoredValue, storeValue, writeCookie } from "@/lib/persistence";
import type { Locale } from "@/types/trading-api";

type AppStateContextValue = {
  locale: Locale;
  notificationsOn: boolean;
  setLocale: (locale: Locale) => void;
  setNotificationsOn: (value: boolean) => void;
  t: MessageTree;
};

const AppStateContext = createContext<AppStateContextValue | null>(null);

const LOCALE_KEY = "trading-web.locale";
const NOTIFICATIONS_KEY = "trading-web.notifications";

export function AppStateProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(() => readStoredValue<Locale>(LOCALE_KEY, defaultLocale));
  const [notificationsOn, setNotificationsOnState] = useState(() => readStoredValue<boolean>(NOTIFICATIONS_KEY, true));

  useEffect(() => {
    if (typeof document !== "undefined") {
      document.documentElement.lang = locale;
    }
  }, [locale]);

  const setLocale = (nextLocale: Locale) => {
    setLocaleState(nextLocale);
    storeValue(LOCALE_KEY, nextLocale);
    writeCookie("trading-web-locale", nextLocale);
    if (typeof document !== "undefined") {
      document.documentElement.lang = nextLocale;
    }
  };

  const setNotificationsOn = (value: boolean) => {
    setNotificationsOnState(value);
    storeValue(NOTIFICATIONS_KEY, value);
    writeCookie("trading-web-notifications", value ? "on" : "off");
  };

  const value = useMemo<AppStateContextValue>(
    () => ({
      locale,
      notificationsOn,
      setLocale,
      setNotificationsOn,
      t: messages[locale],
    }),
    [locale, notificationsOn],
  );

  return <AppStateContext.Provider value={value}>{children}</AppStateContext.Provider>;
}

export function useAppState() {
  const context = useContext(AppStateContext);

  if (!context) {
    throw new Error("useAppState must be used within AppStateProvider");
  }

  return context;
}
