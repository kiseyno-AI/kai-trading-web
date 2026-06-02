import assert from "node:assert/strict";
import test from "node:test";

import { buildNextConfig, normalizeNextBasePath, normalizeNextDistDir } from "./next-config-options";

test("normalizeNextBasePath accepts root and deployment base-path shapes", () => {
  assert.equal(normalizeNextBasePath(""), "");
  assert.equal(normalizeNextBasePath("/"), "");
  assert.equal(normalizeNextBasePath("/trading-web"), "/trading-web");
  assert.equal(normalizeNextBasePath("/trading-web/"), "/trading-web");
  assert.equal(normalizeNextBasePath("trading-web/"), "/trading-web");
});

test("buildNextConfig uses basePath without deriving a versioned asset prefix", () => {
  const config = buildNextConfig(
    {
      NEXT_PUBLIC_BASE_PATH: "/trading-web/",
    },
    "/repo",
  );

  assert.equal(config.basePath, "/trading-web");
  assert.equal(config.assetPrefix, undefined);
  assert.deepEqual(config.turbopack, { root: "/repo" });
});

test("normalizeNextDistDir only opts into a custom output directory when configured", () => {
  assert.equal(normalizeNextDistDir(), undefined);
  assert.equal(normalizeNextDistDir("   "), undefined);
  assert.equal(normalizeNextDistDir(" .next-prod-8383 "), ".next-prod-8383");
});

test("buildNextConfig keeps normal builds on .next unless NEXT_DIST_DIR is set", () => {
  const defaultConfig = buildNextConfig(
    {
      NEXT_PUBLIC_BASE_PATH: "",
    },
    "/repo",
  );
  const productionConfig = buildNextConfig(
    {
      NEXT_DIST_DIR: ".next-prod-8383",
      NEXT_PUBLIC_BASE_PATH: "/trading-web",
    },
    "/repo",
  );

  assert.equal(defaultConfig.distDir, undefined);
  assert.equal(productionConfig.distDir, ".next-prod-8383");
  assert.equal(productionConfig.basePath, "/trading-web");
});
