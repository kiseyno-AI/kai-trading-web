import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const cssPath = join(dirname(fileURLToPath(import.meta.url)), "mobile-app-chrome.module.css");
const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "../../..");

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function getEnclosingMediaQueries(source: string, index: number) {
  const stack: Array<string | null> = [];

  for (let position = 0; position < index; position += 1) {
    const character = source[position];

    if (character === "{") {
      const previousOpen = source.lastIndexOf("{", position - 1);
      const previousClose = source.lastIndexOf("}", position - 1);
      const headerStart = Math.max(previousOpen, previousClose) + 1;
      const header = source.slice(headerStart, position).trim();

      stack.push(header.startsWith("@media") ? header : null);
      continue;
    }

    if (character === "}") {
      stack.pop();
    }
  }

  return stack.filter((query): query is string => query !== null);
}

test("keeps bottom accessory main padding scoped below the desktop layout", () => {
  const css = readFileSync(cssPath, "utf8");
  const selector = '.surface[data-mobile-bottom-accessory="present"] .main';
  const selectorMatches = [...css.matchAll(new RegExp(escapeRegExp(selector), "g"))];

  assert.equal(selectorMatches.length, 1);

  const selectorIndex = selectorMatches[0].index;
  assert.notEqual(selectorIndex, undefined);

  const ruleBlock = css.slice(selectorIndex, css.indexOf("}", selectorIndex) + 1);
  assert.match(ruleBlock, /padding-bottom:\s*calc\(var\(--mobile-bottom-chrome-height\) \+ 0\.4rem\);/);
  assert.deepEqual(getEnclosingMediaQueries(css, selectorIndex), ["@media (max-width: 1023.98px)"]);
});

test("centralizes mobile floating offsets in the shared shell css", () => {
  const shellCss = readFileSync(cssPath, "utf8");
  const dashboardCss = readFileSync(join(repoRoot, "src/app/dashboard/live-dashboard-client.module.css"), "utf8");

  assert.match(shellCss, /--mobile-floating-status-offset:\s*calc\(var\(--mobile-bottom-chrome-height\) \+ 0\.75rem\);/);
  assert.match(dashboardCss, /var\(--mobile-floating-status-offset\)/);
  assert.doesNotMatch(dashboardCss, /mobile-floating-status-offset,\s*calc\([^)]*safe-area-inset-bottom/);
});
