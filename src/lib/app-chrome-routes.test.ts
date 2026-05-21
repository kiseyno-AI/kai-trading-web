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

test("full-screen MobileAppChrome route keys contain only the five dedicated destinations", () => {
  assert.deepEqual(FULL_PAGE_CHROME_ROUTE_KEYS, ["dashboard", "search", "calendar", "portfolio", "symbols"]);
  const navItems = buildAppChromeNavItems(messages.en, FULL_PAGE_CHROME_ROUTE_KEYS);
  const navIds = navItems.map((item) => item.id);

  assert.deepEqual(navIds, FULL_PAGE_CHROME_ROUTE_KEYS);
  assert.deepEqual(navIds.includes("markets"), false);
  assert.equal(navItems.length, 5);
});

test("Markets route chrome can include the full-page destinations plus Markets and Bots", () => {
  const navItems = buildAppChromeNavItems(messages.en, MARKETS_ROUTE_CHROME_ROUTE_KEYS);
  const navIds = navItems.map((item) => item.id);

  assert.deepEqual(
    navIds,
    ["dashboard", "search", "calendar", "portfolio", "symbols", "markets", "bots"],
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
