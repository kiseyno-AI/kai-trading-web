import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import {
  DEFAULT_TAILNET_BROWSER_ENTRYPOINT_URL,
  DEFAULT_TAILNET_HOST,
  normalizeTailnetBrowserEntrypointUrl,
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

test("keeps non-Tailnet HTTP URLs untouched", () => {
  assert.equal(normalizeTailnetBrowserEntrypointUrl("http://127.0.0.1:8383/trading-web"), "http://127.0.0.1:8383/trading-web");
});

test("repo-owned Tailnet defaults publish the browser-safe HTTPS entrypoint", () => {
  const packageJson = JSON.parse(fs.readFileSync(path.join(repoRoot, "package.json"), "utf8")) as {
    scripts?: Record<string, string>;
  };
  const redeployScript = fs.readFileSync(path.join(repoRoot, "scripts/redeploy-prod-8383.sh"), "utf8");
  const readme = fs.readFileSync(path.join(repoRoot, "README.md"), "utf8");
  const productionSection = readme.slice(readme.indexOf("## Production serve on port 8383"));

  assert.match(packageJson.scripts?.["test:e2e:tailnet"] ?? "", /TAILNET_ENTRYPOINT_URL=\$\{TAILNET_ENTRYPOINT_URL:-https:\/\/gangseunghyeon-uiui-macmini-1\.tail1d831c\.ts\.net\/trading-web\}/);
  assert.match(redeployScript, /TAILNET_ENTRYPOINT_URL="\$\{TAILNET_ENTRYPOINT_URL:-https:\/\/\$\{TAILNET_HOST\}\/trading-web\}"/);
  assert.match(redeployScript, /TAILNET_BROWSER_ENTRYPOINT_URL/);
  assert.match(productionSection, new RegExp(DEFAULT_TAILNET_BROWSER_ENTRYPOINT_URL.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.equal(productionSection.includes(legacyHttpEntrypointUrl), false);
});
