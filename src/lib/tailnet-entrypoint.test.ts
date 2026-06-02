import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import {
  DEFAULT_TAILNET_BROWSER_ENTRYPOINT_URL,
  DEFAULT_TAILNET_HOST,
  formatTailnetBrowserNavigationEntrypoint,
  normalizeTailnetBrowserEntrypointUrl,
  resolveTailnetBrowserNavigationEntrypoint,
} from "./tailnet-entrypoint";

const repoRoot = process.cwd();
const legacyHttpEntrypointUrl = `http://${DEFAULT_TAILNET_HOST}/trading-web`;

test("default Tailnet browser entrypoint uses direct HTTPS", () => {
  assert.equal(DEFAULT_TAILNET_BROWSER_ENTRYPOINT_URL, `https://${DEFAULT_TAILNET_HOST}/trading-web`);
});

test("normalizes stale HTTP Tailnet entrypoints before browser smoke", () => {
  assert.equal(normalizeTailnetBrowserEntrypointUrl(legacyHttpEntrypointUrl), DEFAULT_TAILNET_BROWSER_ENTRYPOINT_URL);
  assert.equal(
    normalizeTailnetBrowserEntrypointUrl(`${legacyHttpEntrypointUrl}?from=cron`),
    `${DEFAULT_TAILNET_BROWSER_ENTRYPOINT_URL}?from=cron`,
  );
});

test("resolves stale HTTP Tailnet browser env to HTTPS before Chromium navigation", () => {
  const entrypoint = resolveTailnetBrowserNavigationEntrypoint({
    TAILNET_BROWSER_ENTRYPOINT_URL: legacyHttpEntrypointUrl,
  });

  assert.equal(entrypoint.sourceName, "TAILNET_BROWSER_ENTRYPOINT_URL");
  assert.equal(entrypoint.configuredUrl, legacyHttpEntrypointUrl);
  assert.equal(entrypoint.navigationUrl, DEFAULT_TAILNET_BROWSER_ENTRYPOINT_URL);
  assert.equal(entrypoint.recoveredFromLegacyHttp, true);
  assert.equal(
    formatTailnetBrowserNavigationEntrypoint(entrypoint),
    `Recovered Tailnet browser navigation entrypoint: TAILNET_BROWSER_ENTRYPOINT_URL=${legacyHttpEntrypointUrl} -> ${DEFAULT_TAILNET_BROWSER_ENTRYPOINT_URL}`,
  );
});

test("resolves stale generic Tailnet env to HTTPS browser navigation", () => {
  const entrypoint = resolveTailnetBrowserNavigationEntrypoint({
    TAILNET_ENTRYPOINT_URL: `${legacyHttpEntrypointUrl}?from=cron`,
  });

  assert.equal(entrypoint.sourceName, "TAILNET_ENTRYPOINT_URL");
  assert.equal(entrypoint.navigationUrl, `${DEFAULT_TAILNET_BROWSER_ENTRYPOINT_URL}?from=cron`);
  assert.equal(entrypoint.recoveredFromLegacyHttp, true);
});

test("prefers browser-specific Tailnet entrypoint over the generic fallback", () => {
  const browserSpecificUrl = `${legacyHttpEntrypointUrl}?source=browser`;
  const genericUrl = `${DEFAULT_TAILNET_BROWSER_ENTRYPOINT_URL}?source=generic`;
  const entrypoint = resolveTailnetBrowserNavigationEntrypoint({
    TAILNET_BROWSER_ENTRYPOINT_URL: browserSpecificUrl,
    TAILNET_ENTRYPOINT_URL: genericUrl,
  });

  assert.equal(entrypoint.sourceName, "TAILNET_BROWSER_ENTRYPOINT_URL");
  assert.equal(entrypoint.configuredUrl, browserSpecificUrl);
  assert.equal(entrypoint.navigationUrl, `${DEFAULT_TAILNET_BROWSER_ENTRYPOINT_URL}?source=browser`);
});

test("keeps non-Tailnet HTTP URLs untouched", () => {
  assert.equal(normalizeTailnetBrowserEntrypointUrl("http://127.0.0.1:8383/trading-web"), "http://127.0.0.1:8383/trading-web");
});

test("repo-owned Tailnet defaults publish the browser-safe HTTPS entrypoint", () => {
  const packageJson = JSON.parse(fs.readFileSync(path.join(repoRoot, "package.json"), "utf8")) as {
    scripts?: Record<string, string>;
  };
  const redeployScript = fs.readFileSync(path.join(repoRoot, "scripts/redeploy-prod-8383.sh"), "utf8");
  const startScript = fs.readFileSync(path.join(repoRoot, "scripts/start-prod-8383.sh"), "utf8");
  const readme = fs.readFileSync(path.join(repoRoot, "README.md"), "utf8");
  const productionSection = readme.slice(readme.indexOf("## Production serve on port 8383"));

  assert.match(packageJson.scripts?.["test:e2e:tailnet"] ?? "", /TAILNET_ENTRYPOINT_URL=\$\{TAILNET_ENTRYPOINT_URL:-https:\/\/gangseunghyeon-uiui-macmini-1\.tail1d831c\.ts\.net\/trading-web\}/);
  assert.match(redeployScript, /TAILNET_ENTRYPOINT_URL="\$\{TAILNET_ENTRYPOINT_URL:-https:\/\/\$\{TAILNET_HOST\}\/trading-web\}"/);
  assert.match(redeployScript, /NEXT_DIST_DIR="\$\{NEXT_DIST_DIR:-\.next-prod-8383\}"/);
  assert.match(redeployScript, /is_shared_next_dist_dir\(\)/);
  assert.match(redeployScript, /path\.resolve\(process\.cwd\(\), raw\.trim\(\)\) === path\.resolve\(process\.cwd\(\), "\.next"\)/);
  assert.match(redeployScript, /required-server-files\.json/);
  assert.match(redeployScript, /app HTML asset path sanity check failed/);
  assert.match(redeployScript, /TAILNET_BROWSER_ENTRYPOINT_URL/);
  assert.match(redeployScript, /RAW_TAILNET_BROWSER_ENTRYPOINT_URL/);
  assert.match(redeployScript, /normalized Tailnet browser entrypoint from .+ to /);
  assert.match(startScript, /NEXT_DIST_DIR="\$\{NEXT_DIST_DIR:-\.next-prod-8383\}"/);
  assert.match(startScript, /is_shared_next_dist_dir\(\)/);
  assert.match(startScript, /path\.resolve\(process\.cwd\(\), raw\.trim\(\)\) === path\.resolve\(process\.cwd\(\), "\.next"\)/);
  assert.match(startScript, /APP_VERSION_FILE="\$\{NEXT_DIST_DIR\}\/APP_VERSION"/);
  assert.match(productionSection, new RegExp(DEFAULT_TAILNET_BROWSER_ENTRYPOINT_URL.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.match(productionSection, /\.next-prod-8383/);
  assert.equal(productionSection.includes(legacyHttpEntrypointUrl), false);
});
