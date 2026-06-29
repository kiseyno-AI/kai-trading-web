import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const cssPath = join(dirname(fileURLToPath(import.meta.url)), "mobile-app-chrome.module.css");
const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "../../..");

test("reserves shared mobile bottom chrome in main padding for every route", () => {
  const css = readFileSync(cssPath, "utf8");
  const selector = '.surface[data-mobile-bottom-accessory="present"] .main';
  const accessoryOverrideMatches = [...css.matchAll(new RegExp(selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g"))];

  assert.match(css, /--mobile-bottom-content-buffer:\s*1\.55rem;/);
  assert.match(
    css,
    /\.main\s*\{[^}]*padding:\s*5\.5rem 0\.9rem calc\(var\(--mobile-bottom-chrome-height\) \+ var\(--mobile-bottom-content-buffer\)\);/s,
  );
  assert.equal(
    accessoryOverrideMatches.length,
    0,
    "Accessory routes should inherit the shared chrome reserve instead of using a smaller override.",
  );
});

test("process monitor modal no longer depends on the mobile floating chrome offset", () => {
  const shellCss = readFileSync(cssPath, "utf8");
  const dashboardCss = readFileSync(join(repoRoot, "src/app/dashboard/live-dashboard-client.module.css"), "utf8");
  const dashboardSource = readFileSync(join(repoRoot, "src/app/dashboard/live-dashboard-client.tsx"), "utf8");

  assert.match(shellCss, /--mobile-floating-status-offset:\s*calc\(var\(--mobile-bottom-chrome-height\) \+ 0\.75rem\);/);
  assert.doesNotMatch(dashboardCss, /var\(--mobile-floating-status-offset\)/);
  assert.doesNotMatch(dashboardCss, /mobile-floating-status-offset,\s*calc\([^)]*safe-area-inset-bottom/);
  assert.match(dashboardSource, /const processMonitorModalLayer = processMonitorDrawerMounted \?/);
  assert.match(dashboardSource, /modalLayer:\s*processMonitorModalLayer,/);
  assert.match(dashboardSource, /modalOpen:\s*dialogOpen,/);
  assert.doesNotMatch(dashboardSource, /processMonitorFloatingLayer/);
  assert.doesNotMatch(dashboardSource, /floatingLayer:\s*processMonitor/);
  assert.match(
    dashboardCss,
    /\.processMonitorDrawerBackdrop\s*\{[^}]*inset:\s*0;[^}]*align-items:\s*stretch;[^}]*padding:\s*0;[^}]*backdrop-filter:\s*blur\(10px\);/s,
  );
  assert.match(
    dashboardCss,
    /\.processMonitorDrawer\s*\{[^}]*height:\s*100dvh;[^}]*display:\s*flex;[^}]*overflow:\s*hidden;/s,
  );
  assert.match(
    dashboardCss,
    /\.processMonitorDrawerBody\s*\{[^}]*overflow-y:\s*auto;[^}]*overscroll-behavior:\s*contain;/s,
  );
});

test("contained mobile content leaves a gutter above fixed bottom accessories", () => {
  const css = readFileSync(cssPath, "utf8");

  assert.match(
    css,
    /\.surface\[data-mobile-content-scroll="contained"\]\[data-mobile-bottom-accessory="present"\]\s*\.main\s*\{[^}]*height:\s*calc\(100dvh - var\(--mobile-bottom-chrome-height\) - var\(--mobile-bottom-content-buffer\)\);/s,
  );
});

test("desktop rail keeps metadata and navigation scrollable at fixed desktop widths", () => {
  const css = readFileSync(cssPath, "utf8");

  assert.match(css, /\.desktopRail\s*\{[^}]*height:\s*100dvh;[^}]*overflow-y:\s*auto;[^}]*overscroll-behavior:\s*contain;/s);
  assert.match(css, /\.desktopNav\s*\{[^}]*flex:\s*1 1 auto;[^}]*overflow-y:\s*auto;/s);
  assert.match(css, /\.desktopRailMetaGroup\s*\{/);
  assert.match(css, /\.desktopRailScreenName\s*\{[^}]*text-overflow:\s*ellipsis;[^}]*white-space:\s*nowrap;/s);
  assert.match(css, /\.toolbarLanguageAction\s*\{[^}]*display:\s*none;/s);
});
