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

test("full-screen MobileAppChrome route keys expose only primary chrome destinations", () => {
  assert.deepEqual(FULL_PAGE_CHROME_ROUTE_KEYS, [
    "dashboard",
    "search",
    "calendar",
    "portfolio",
    "symbols",
  ]);
  const navItems = buildAppChromeNavItems(messages.en, FULL_PAGE_CHROME_ROUTE_KEYS);
  const navIds = navItems.map((item) => item.id);

  assert.deepEqual(navIds, FULL_PAGE_CHROME_ROUTE_KEYS);
  assert.equal(navItems.length, 5);
  assert.equal(navItems.some((item) => item.id === "markets"), false);
  assert.equal(navItems.some((item) => item.id === "bots"), false);
});

test("Markets route chrome exposes the broader AppShell destinations", () => {
  const navItems = buildAppChromeNavItems(messages.en, MARKETS_ROUTE_CHROME_ROUTE_KEYS);
  const navIds = navItems.map((item) => item.id);

  assert.deepEqual(MARKETS_ROUTE_CHROME_ROUTE_KEYS, APP_SHELL_ROUTE_KEYS);
  assert.deepEqual(navIds, APP_SHELL_ROUTE_KEYS);
  assert.equal(navItems.find((item) => item.id === "markets")?.href, "/markets");
  assert.equal(navItems.find((item) => item.id === "bots")?.href, "/bots");
});

test("broader AppShell navigation still exposes Markets and Bots for workspace routes", () => {
  const shellNavItems = buildAppChromeNavItems(messages.en, APP_SHELL_ROUTE_KEYS);
  assert.deepEqual(
    shellNavItems.map((item) => item.id),
    APP_SHELL_ROUTE_KEYS,
  );
  assert.equal(shellNavItems.some((item) => item.id === "markets"), true);
  assert.equal(shellNavItems.some((item) => item.id === "bots"), true);
  assert.equal(APP_CHROME_ROUTE_BY_KEY.markets.navigationItemKey, "markets");
  assert.equal(APP_CHROME_ROUTE_BY_KEY.markets.defaultHref, "/markets");
  assert.equal(APP_CHROME_ROUTE_BY_KEY.bots.navigationItemKey, "bots");
  assert.equal(APP_CHROME_ROUTE_BY_KEY.bots.defaultHref, "/bots");

  const marketsMetadata = resolveMobileAppChromeMetadata({
    pathname: "/markets",
    activeNav: "markets",
    t: messages.en,
  });

  assert.equal(marketsMetadata.title, "Markets");
});
