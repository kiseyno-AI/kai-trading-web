import assert from "node:assert/strict";
import test from "node:test";

import { messages } from "@/i18n/messages";

import {
  PRIMARY_APP_CHROME_ROUTE_KEYS,
  buildAppChromeNavItems,
  resolvePrimaryAppChromeRouteKey,
} from "./app-chrome-routes";

const EXPECTED_PRIMARY_ROUTE_KEYS = ["dashboard", "search", "calendar", "portfolio"];

test("every app chrome surface shares one four-destination route set", () => {
  assert.deepEqual(PRIMARY_APP_CHROME_ROUTE_KEYS, EXPECTED_PRIMARY_ROUTE_KEYS);

  const navItems = buildAppChromeNavItems(messages.en);

  assert.deepEqual(
    navItems.map(({ id, href, label }) => ({ id, href, label })),
    [
      { id: "dashboard", href: "/dashboard", label: "Overview" },
      { id: "search", href: "/search", label: "Explore" },
      { id: "calendar", href: "/calendar", label: "Review" },
      { id: "portfolio", href: "/portfolio", label: "Portfolio" },
    ],
  );
  assert.equal(navItems.length, 4);
  assert.equal(navItems.some((item) => item.id === "symbols"), false);
  assert.equal(navItems.some((item) => item.id === "markets"), false);
  assert.equal(navItems.some((item) => item.id === "bots"), false);
});

test("Korean navigation copy follows the same outcome-oriented route model", () => {
  const navItems = buildAppChromeNavItems(messages.ko);

  assert.deepEqual(
    navItems.map(({ id, label }) => ({ id, label })),
    [
      { id: "dashboard", label: "개요" },
      { id: "search", label: "탐색" },
      { id: "calendar", label: "검토" },
      { id: "portfolio", label: "포트폴리오" },
    ],
  );
});

test("route-state hrefs can be preserved without changing the global destinations", () => {
  const navItems = buildAppChromeNavItems(messages.en, {
    calendar: "/calendar?date=2026-04-27",
  });

  assert.equal(navItems.find((item) => item.id === "calendar")?.href, "/calendar?date=2026-04-27");
  assert.deepEqual(navItems.map((item) => item.id), EXPECTED_PRIMARY_ROUTE_KEYS);
});

test("secondary exploration routes keep Explore active in the four-item navigation", () => {
  assert.equal(resolvePrimaryAppChromeRouteKey("symbols"), "search");
  assert.equal(resolvePrimaryAppChromeRouteKey("markets"), "search");
  assert.equal(resolvePrimaryAppChromeRouteKey("calendar"), "calendar");
  assert.equal(resolvePrimaryAppChromeRouteKey(null), null);
});
