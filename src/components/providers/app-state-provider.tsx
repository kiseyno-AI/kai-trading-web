"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

import { defaultLocale, messages, type MessageTree } from "@/i18n/messages";
import { readStoredValue, storeValue, writeCookie } from "@/lib/persistence";
import type { Locale } from "@/types/trading-api";

type AppStateContextValue = {
  locale: Locale;
  notificationsOn: boolean;
  devMode: boolean;
  setLocale: (locale: Locale) => void;
  setNotificationsOn: (value: boolean) => void;
  setDevMode: (value: boolean) => void;
  t: MessageTree;
};

const AppStateContext = createContext<AppStateContextValue | null>(null);

const LOCALE_KEY = "trading-web.locale";
const NOTIFICATIONS_KEY = "trading-web.notifications";
const DEV_MODE_KEY = "trading-web.dev-mode";

export function AppStateProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(() => readStoredValue<Locale>(LOCALE_KEY, defaultLocale));
  const [notificationsOn, setNotificationsOnState] = useState(() => readStoredValue<boolean>(NOTIFICATIONS_KEY, true));
  const [devMode, setDevModeState] = useState(() => readStoredValue<boolean>(DEV_MODE_KEY, false));

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

  const setDevMode = (value: boolean) => {
    setDevModeState(value);
    storeValue(DEV_MODE_KEY, value);
    writeCookie("trading-web-dev-mode", value ? "on" : "off");
  };

  const value = useMemo<AppStateContextValue>(
    () => ({
      locale,
      notificationsOn,
      devMode,
      setLocale,
      setNotificationsOn,
      setDevMode,
      t: messages[locale],
    }),
    [devMode, locale, notificationsOn],
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
