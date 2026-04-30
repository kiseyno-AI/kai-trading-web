import assert from "node:assert/strict";
import test from "node:test";

import { messages } from "@/i18n/messages";

import { resolveMobileAppChromeMetadata } from "./mobile-app-chrome-route-metadata";

test("non-dashboard full-screen routes inherit no dev-mode control by default", () => {
  const metadata = resolveMobileAppChromeMetadata({
    pathname: "/search",
    activeNav: "search",
    t: messages.en,
  });

  assert.equal(metadata.title, "Search Workspace");
  assert.equal(metadata.toolbarAction, "none");
});

test("calendar full-screen route title and toolbar action come from shared metadata", () => {
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
