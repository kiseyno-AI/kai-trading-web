import assert from "node:assert/strict";
import test from "node:test";

import { messages } from "@/i18n/messages";

import { resolveMobileAppChromeMetadata } from "./mobile-app-chrome-route-metadata";

test("search route is configured to expose dev-mode controls from shared metadata", () => {
  const metadata = resolveMobileAppChromeMetadata({
    pathname: "/search",
    activeNav: "search",
    t: messages.en,
  });

  assert.equal(metadata.title, "Search Workspace");
  assert.equal(metadata.toolbarAction, "dev-mode");
});

test("my-symbols route keeps shared dev-mode toolbar controls", () => {
  const metadata = resolveMobileAppChromeMetadata({
    pathname: "/my-symbols",
    activeNav: "symbols",
    t: messages.en,
  });

  assert.equal(metadata.toolbarAction, "dev-mode");
});

test("non-dashboard unmatched routes inherit no dev-mode control by default", () => {
  const metadata = resolveMobileAppChromeMetadata({
    pathname: "/portfolio-details",
    activeNav: null,
    t: messages.en,
  });

  assert.equal(metadata.toolbarAction, "none");
});

test("portfolio route keeps shared dev-mode toolbar controls", () => {
  const metadata = resolveMobileAppChromeMetadata({
    pathname: "/portfolio",
    activeNav: "portfolio",
    t: messages.en,
  });

  assert.equal(metadata.toolbarAction, "dev-mode");
});

test("calendar full-screen routes resolve explicit no-dev-mode title and toolbar action", () => {
  const metadata = resolveMobileAppChromeMetadata({
    pathname: "/calendar",
    activeNav: "calendar",
    t: messages.en,
  });

  assert.equal(metadata.title, "Signal Review Calendar");
  assert.equal(metadata.toolbarAction, "none");
});

test("dashboard workflow routes resolve explicit titles from pathname", () => {
  const metadata = resolveMobileAppChromeMetadata({
    pathname: "/dashboard/signal-decider-feedback",
    activeNav: "dashboard",
    t: messages.en,
  });

  assert.equal(metadata.title, "Signal Decider Feedback");
  assert.equal(metadata.toolbarAction, "dev-mode");
});
