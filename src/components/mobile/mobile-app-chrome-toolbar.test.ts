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

test("routes that use MobileAppChrome compose the shared dashboard toolbar", () => {
  const offenders = collectFiles(appRoot, (path) => path.endsWith(".tsx"))
    .filter((path) => {
      const source = readFileSync(path, "utf8");
      return source.includes("<MobileAppChrome") && !source.includes("<DashboardToolbar");
    })
    .map((path) => relative(repoRoot, path));

  assert.deepEqual(offenders, []);
});

test("AppShell topbar composes the shared dashboard toolbar", () => {
  const source = readFileSync(join(repoRoot, "src/components/navigation/topbar.tsx"), "utf8");

  assert.match(source, /from "@\/components\/navigation\/dashboard-toolbar"/);
  assert.match(source, /<DashboardToolbar/);
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
