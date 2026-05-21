import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const calendarCssPath = join(dirname(fileURLToPath(import.meta.url)), "../../app/calendar/signal-review-calendar-page.module.css");
const calendarCss = readFileSync(calendarCssPath, "utf8");

function hasCalendarStackSafeAreaRule(source: string) {
  return /@media \(max-width:\s*1023\.98px\)\s*\{[\s\S]*?\.stack\s*\{[\s\S]*?padding-bottom:\s*var\(--mobile-floating-status-offset\);[\s\S]*?\}/.test(
    source,
  );
}

test("calendar stack reserves mobile bottom chrome spacing", () => {
  assert.ok(hasCalendarStackSafeAreaRule(calendarCss), "Expected .stack mobile rule with var(--mobile-floating-status-offset)");
});
