import assert from "node:assert/strict";
import test from "node:test";

import { buildNextConfig, normalizeNextBasePath } from "./next-config-options";

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
