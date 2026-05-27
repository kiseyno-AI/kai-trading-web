import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const calendarCssPath = join(dirname(fileURLToPath(import.meta.url)), "../../app/calendar/signal-review-calendar-page.module.css");
const calendarSourcePath = join(dirname(fileURLToPath(import.meta.url)), "../../app/calendar/signal-review-calendar-page-client.tsx");
const chromeCssPath = join(dirname(fileURLToPath(import.meta.url)), "mobile-app-chrome.module.css");
const calendarCss = readFileSync(calendarCssPath, "utf8");
const calendarSource = readFileSync(calendarSourcePath, "utf8");
const chromeCss = readFileSync(chromeCssPath, "utf8");

test("calendar uses the shared contained mobile scrollport instead of page-local bottom padding", () => {
  assert.match(calendarSource, /contentScrollMode:\s*"contained"/);
  assert.doesNotMatch(calendarCss, /--mobile-floating-status-offset|--mobile-bottom-chrome-height/);
  assert.match(chromeCss, /\.surface\[data-mobile-content-scroll="contained"\]\s*\.main\s*\{/);
  assert.match(chromeCss, /height:\s*calc\(100dvh - var\(--mobile-bottom-chrome-height\)\);/);
  assert.match(chromeCss, /scroll-padding-bottom:\s*var\(--mobile-bottom-content-buffer\);/);
});
