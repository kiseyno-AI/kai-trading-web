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

test("centralizes mobile floating offsets in the shared shell css", () => {
  const shellCss = readFileSync(cssPath, "utf8");
  const dashboardCss = readFileSync(join(repoRoot, "src/app/dashboard/live-dashboard-client.module.css"), "utf8");

  assert.match(shellCss, /--mobile-floating-status-offset:\s*calc\(var\(--mobile-bottom-chrome-height\) \+ 0\.75rem\);/);
  assert.match(dashboardCss, /var\(--mobile-floating-status-offset\)/);
  assert.doesNotMatch(dashboardCss, /mobile-floating-status-offset,\s*calc\([^)]*safe-area-inset-bottom/);
});

test("desktop rail keeps metadata and navigation scrollable at fixed desktop widths", () => {
  const css = readFileSync(cssPath, "utf8");

  assert.match(css, /\.desktopRail\s*\{[^}]*height:\s*100dvh;[^}]*overflow-y:\s*auto;[^}]*overscroll-behavior:\s*contain;/s);
  assert.match(css, /\.desktopNav\s*\{[^}]*flex:\s*1 1 auto;[^}]*overflow-y:\s*auto;/s);
  assert.match(css, /\.desktopRailMetaGroup\s*\{/);
  assert.match(css, /\.desktopRailScreenName\s*\{[^}]*text-overflow:\s*ellipsis;[^}]*white-space:\s*nowrap;/s);
  assert.match(css, /\.toolbarLanguageAction\s*\{[^}]*display:\s*none;/s);
});
