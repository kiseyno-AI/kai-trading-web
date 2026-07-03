import assert from "node:assert/strict";
import test from "node:test";

import { messages } from "@/i18n/messages";

import {
  APP_CHROME_ROUTE_BY_KEY,
  APP_SHELL_ROUTE_KEYS,
  FULL_PAGE_CHROME_ROUTE_KEYS,
  MARKETS_ROUTE_CHROME_ROUTE_KEYS,
  buildAppChromeNavItems,
} from "./app-chrome-routes";
import { resolveMobileAppChromeMetadata } from "./mobile-app-chrome-route-metadata";

test("full-screen MobileAppChrome route keys expose all supported shell destinations", () => {
  assert.deepEqual(FULL_PAGE_CHROME_ROUTE_KEYS, [
    "dashboard",
    "search",
    "calendar",
    "portfolio",
    "symbols",
    "markets",
    "bots",
  ]);
  const navItems = buildAppChromeNavItems(messages.en, FULL_PAGE_CHROME_ROUTE_KEYS);
  const navIds = navItems.map((item) => item.id);

  assert.deepEqual(navIds, FULL_PAGE_CHROME_ROUTE_KEYS);
  assert.equal(navItems.length, 7);
  assert.equal(navItems.find((item) => item.id === "markets")?.href, "/markets");
  assert.equal(navItems.find((item) => item.id === "bots")?.href, "/bots");
});

test("Markets route chrome uses the same canonical full-screen destinations", () => {
  const navItems = buildAppChromeNavItems(messages.en, MARKETS_ROUTE_CHROME_ROUTE_KEYS);
  const navIds = navItems.map((item) => item.id);

  assert.deepEqual(
    navIds,
    FULL_PAGE_CHROME_ROUTE_KEYS,
  );
});

test("broader AppShell navigation still exposes Markets for dedicated route metadata workflows", () => {
  const shellNavItems = buildAppChromeNavItems(messages.en, APP_SHELL_ROUTE_KEYS);
  assert.equal(shellNavItems.some((item) => item.id === "markets"), true);
  assert.equal(APP_CHROME_ROUTE_BY_KEY.markets.navigationItemKey, "markets");
  assert.equal(APP_CHROME_ROUTE_BY_KEY.markets.defaultHref, "/markets");

  const marketsMetadata = resolveMobileAppChromeMetadata({
    pathname: "/markets",
    activeNav: "markets",
    t: messages.en,
  });

  assert.equal(marketsMetadata.title, "Markets");
});
