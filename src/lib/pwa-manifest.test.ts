import assert from "node:assert/strict";
import test from "node:test";

import { buildPwaManifest, normalizeManifestBasePath } from "./pwa-manifest";

test("buildPwaManifest keeps local manifest paths root-relative without a base path", () => {
  const manifest = buildPwaManifest("");

  assert.equal(manifest.start_url, "/dashboard");
  assert.deepEqual(
    manifest.icons?.map((icon) => icon.src),
    ["/app-icon-192.png", "/app-icon-512.png", "/app-icon-512.png"],
  );
});

test("buildPwaManifest prefixes install URLs with the configured deployment base path", () => {
  const manifest = buildPwaManifest("/trading-web");

  assert.equal(manifest.start_url, "/trading-web/dashboard");
  assert.deepEqual(
    manifest.icons?.map((icon) => icon.src),
    [
      "/trading-web/app-icon-192.png",
      "/trading-web/app-icon-512.png",
      "/trading-web/app-icon-512.png",
    ],
  );
});

test("normalizeManifestBasePath accepts the deployment env shape and avoids double slashes", () => {
  assert.equal(normalizeManifestBasePath(undefined), "");
  assert.equal(normalizeManifestBasePath(""), "");
  assert.equal(normalizeManifestBasePath("/"), "");
  assert.equal(normalizeManifestBasePath("/trading-web"), "/trading-web");
  assert.equal(normalizeManifestBasePath("/trading-web/"), "/trading-web");
  assert.equal(normalizeManifestBasePath("trading-web/"), "/trading-web");
});

test("buildPwaManifest reads NEXT_PUBLIC_BASE_PATH by default", (t) => {
  const originalBasePath = process.env.NEXT_PUBLIC_BASE_PATH;
  t.after(() => {
    if (originalBasePath === undefined) {
      delete process.env.NEXT_PUBLIC_BASE_PATH;
    } else {
      process.env.NEXT_PUBLIC_BASE_PATH = originalBasePath;
    }
  });

  process.env.NEXT_PUBLIC_BASE_PATH = "/trading-web";

  assert.equal(buildPwaManifest().start_url, "/trading-web/dashboard");
});
