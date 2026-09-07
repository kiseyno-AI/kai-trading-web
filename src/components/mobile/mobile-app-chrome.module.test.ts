import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const cssPath = join(dirname(fileURLToPath(import.meta.url)), "mobile-app-chrome.module.css");
const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "../../..");

test("reserves one compact mobile navigation bar in main padding for every route", () => {
  const css = readFileSync(cssPath, "utf8");

  assert.match(css, /--mobile-bottom-content-buffer:\s*1rem;/);
  assert.match(
    css,
    /\.main\s*\{[^}]*padding:\s*4\.8rem 0\.75rem calc\(var\(--mobile-bottom-chrome-height\) \+ var\(--mobile-bottom-content-buffer\)\);/s,
  );
  assert.doesNotMatch(css, /mobile-bottom-accessory|bottomAccessory/);
  assert.match(css, /\.bottomNav\s*\{[^}]*grid-template-columns:\s*repeat\(4, minmax\(0, 1fr\)\);/s);
});

test("process monitor modal no longer depends on the mobile floating chrome offset", () => {
  const shellCss = readFileSync(cssPath, "utf8");
  const dashboardCss = readFileSync(join(repoRoot, "src/app/dashboard/live-dashboard-client.module.css"), "utf8");
  const dashboardSource = readFileSync(join(repoRoot, "src/app/dashboard/live-dashboard-client.tsx"), "utf8");

  assert.doesNotMatch(shellCss, /mobile-floating-status-offset/);
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

test("contained mobile content stops above the fixed bottom navigation", () => {
  const css = readFileSync(cssPath, "utf8");

  assert.match(
    css,
    /\.surface\[data-mobile-content-scroll="contained"\]\s*\.main\s*\{[^}]*height:\s*calc\(100dvh - var\(--mobile-bottom-chrome-height\)\);/s,
  );
  assert.doesNotMatch(css, /data-mobile-bottom-accessory/);
});

test("desktop rail keeps metadata and navigation scrollable at fixed desktop widths", () => {
  const css = readFileSync(cssPath, "utf8");

  assert.match(css, /\.desktopRail\s*\{[^}]*height:\s*100dvh;[^}]*overflow-y:\s*auto;[^}]*overscroll-behavior:\s*contain;/s);
  assert.match(css, /\.desktopNav\s*\{[^}]*flex:\s*1 1 auto;[^}]*overflow-y:\s*auto;/s);
  assert.match(css, /\.desktopRailMetaGroup\s*\{/);
  assert.match(css, /\.desktopRailScreenName\s*\{[^}]*text-overflow:\s*ellipsis;[^}]*white-space:\s*nowrap;/s);
  assert.match(css, /\.toolbarLanguageAction\s*\{[^}]*display:\s*none;/s);
});
