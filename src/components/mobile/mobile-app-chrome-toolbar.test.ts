import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "../../..");
const appRoot = join(repoRoot, "src/app");

function collectFiles(directory: string, matcher: (path: string) => boolean) {
  const entries = readdirSync(directory);
  const files: string[] = [];

  for (const entry of entries) {
    const path = join(directory, entry);
    const stats = statSync(path);

    if (stats.isDirectory()) {
      files.push(...collectFiles(path, matcher));
      continue;
    }

    if (matcher(path)) {
      files.push(path);
    }
  }

  return files;
}

test("routes that use MobileAppChrome provide chrome metadata instead of page-local shell slots", () => {
  const offenders = collectFiles(appRoot, (path) => path.endsWith(".tsx"))
    .filter((path) => {
      const source = readFileSync(path, "utf8");
      return (
        source.includes("<MobileAppChrome") &&
        (/<DashboardToolbar[\s>]/.test(source) ||
          /\btopbar=/.test(source) ||
          /\bbottomChrome=/.test(source) ||
          /\bdesktopRail=/.test(source) ||
          /\bfloatingLayer=/.test(source) ||
          /\bactiveNav=/.test(source))
      );
    })
    .map((path) => relative(repoRoot, path));

  assert.deepEqual(offenders, []);
});

test("MobileAppChrome owns the shared dashboard toolbar frame and standardized actions", () => {
  const source = readFileSync(join(repoRoot, "src/components/mobile/mobile-app-chrome.tsx"), "utf8");

  assert.match(source, /from "@\/components\/navigation\/dashboard-toolbar"/);
  assert.match(source, /DashboardToolbarStatus/);
  assert.match(source, /LanguageSwitchControl/);
  assert.match(source, /DevModeToggle/);
  assert.match(source, /<DashboardToolbar/);
  assert.match(source, /actions=\{toolbarActions\}/);
});

test("AppShell topbar composes the shared dashboard toolbar", () => {
  const source = readFileSync(join(repoRoot, "src/components/navigation/topbar.tsx"), "utf8");

  assert.match(source, /from "@\/components\/navigation\/dashboard-toolbar"/);
  assert.match(source, /<DashboardToolbar/);
});

test("shared dashboard toolbar uses the provided transparent logo asset", () => {
  const toolbarSource = readFileSync(join(repoRoot, "src/components/navigation/dashboard-toolbar.tsx"), "utf8");
  const toolbarStyles = readFileSync(join(repoRoot, "src/components/navigation/dashboard-toolbar.module.css"), "utf8");
  const logo = readFileSync(join(repoRoot, "src/components/navigation/trading-toolbar-logo.png"));

  assert.doesNotMatch(toolbarSource, />\s*K\s*</);
  assert.match(toolbarSource, /className=\{styles\.brandMark\} aria-hidden="true" \/>/);
  assert.match(toolbarStyles, /trading-toolbar-logo\.png/);
  assert.equal(logo.subarray(0, 8).toString("hex"), "89504e470d0a1a0a");
  assert.equal(logo[25], 6);
});

test("desktop brand mark in mobile chrome uses shared logo asset", () => {
  const chromeSource = readFileSync(join(repoRoot, "src/components/mobile/mobile-app-chrome.tsx"), "utf8");
  const chromeStyles = readFileSync(join(repoRoot, "src/components/mobile/mobile-app-chrome.module.css"), "utf8");
  const logo = readFileSync(join(repoRoot, "src/components/navigation/trading-toolbar-logo.png"));

  assert.doesNotMatch(chromeSource, /desktopBrandMark[^]*?>\s*KAI\s*<\/div>/);
  assert.match(chromeSource, /desktopBrandMark[^>]*aria-hidden="true"\s*\/>/);
  assert.match(chromeStyles, /\.desktopBrandMark\s*\{[^\}]*background-image:\s*url\(["']?\.\.\/navigation\/trading-toolbar-logo\.png["']?\)/);
  assert.equal(logo.subarray(0, 8).toString("hex"), "89504e470d0a1a0a");
  assert.equal(logo[25], 6);
});

test("AppShell and MobileAppChrome share the central route model", () => {
  const appShellSource = readFileSync(join(repoRoot, "src/components/layout/app-shell.tsx"), "utf8");
  const mobileChromeSource = readFileSync(join(repoRoot, "src/components/mobile/mobile-app-chrome.tsx"), "utf8");

  assert.match(appShellSource, /buildAppChromeNavItems/);
  assert.match(appShellSource, /buildAppChromeSearchSuggestions/);
  assert.match(mobileChromeSource, /FULL_PAGE_CHROME_ROUTE_KEYS/);
  assert.match(mobileChromeSource, /buildAppChromeNavItems/);
});

test("full-screen routes use the shared chrome metadata model for representative pages", () => {
  const representativeRoutes = [
    "src/app/calendar/signal-review-calendar-page-client.tsx",
    "src/app/my-symbols/my-symbols-page-client.tsx",
    "src/app/dashboard/piotroski-filter/piotroski-filter-page-client.tsx",
    "src/app/dashboard/symbol/[symbol]/symbol-detail-client.tsx",
  ];

  for (const route of representativeRoutes) {
    const source = readFileSync(join(repoRoot, route), "utf8");

    assert.match(source, /<MobileAppChrome\s+chrome=/, route);
    assert.doesNotMatch(source, /DevModeToggle/, route);
    assert.doesNotMatch(source, /\bDashboardToolbarStatus\b/, route);
    assert.doesNotMatch(source, /\btopbar=|\bbottomChrome=|\bdesktopRail=|\bfloatingLayer=/, route);
  }
});

test("MobileAppChrome keeps dashboard bottom chrome canonical for full-screen routes", () => {
  const source = readFileSync(join(repoRoot, "src/components/mobile/mobile-app-chrome.tsx"), "utf8");

  assert.match(source, /const bottomAccessory = chrome\.bottomAccessory;/);
  assert.match(source, /const bottomMeta = null;/);
  assert.match(source, /const desktopRailFooter = <MobileAppChromeDesktopRailFooter \/>;/);
  assert.doesNotMatch(source, /bottomChrome/);
  assert.doesNotMatch(source, /desktopRail\?/);
});

test("legacy page-local toolbar selectors stay out of route chrome styles", () => {
  const legacySelectors = [
    "appHeaderBrand",
    "headerBrand",
    "marketStatusPill",
    "marketStatusClosedPill",
    "marketDatePill",
    "monthPill",
    "topbar-brand",
    "topbar-main",
  ];
  const files = [
    ...collectFiles(appRoot, (path) => path.endsWith(".module.css")),
    join(repoRoot, "src/app/globals.css"),
  ];
  const offenders = files
    .flatMap((path) => {
      const source = readFileSync(path, "utf8");
      return legacySelectors
        .filter((selector) => source.includes(selector))
        .map((selector) => `${relative(repoRoot, path)}:${selector}`);
    });

  assert.deepEqual(offenders, []);
});

test("explicit route chrome toolbarAction can override shared metadata defaults", () => {
  const source = readFileSync(join(repoRoot, "src/components/mobile/mobile-app-chrome.tsx"), "utf8");

  assert.match(source, /chrome\.toolbarAction \?\? resolvedMetadata\?\.toolbarAction \?\? "none"/);
  assert.doesNotMatch(source, /resolvedMetadata\?\.toolbarAction === "none"/);
});
