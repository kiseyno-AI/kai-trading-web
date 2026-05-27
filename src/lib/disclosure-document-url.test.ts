import assert from "node:assert/strict";
import test from "node:test";

import { normalizeAppBasePath, withAppBasePath } from "./app-base-path";
import { buildDisclosureDocumentUrl } from "./disclosure-document-url";

test("normalizeAppBasePath accepts root and deployment base-path shapes", () => {
  assert.equal(normalizeAppBasePath(undefined), "");
  assert.equal(normalizeAppBasePath(""), "");
  assert.equal(normalizeAppBasePath("/"), "");
  assert.equal(normalizeAppBasePath("/trading-web"), "/trading-web");
  assert.equal(normalizeAppBasePath("/trading-web/"), "/trading-web");
  assert.equal(normalizeAppBasePath("trading-web/"), "/trading-web");
});

test("withAppBasePath preserves root deployments and prefixes nested deployments", () => {
  assert.equal(withAppBasePath("/api/trading/health", ""), "/api/trading/health");
  assert.equal(withAppBasePath("/api/trading/health", "/trading-web"), "/trading-web/api/trading/health");
});

test("buildDisclosureDocumentUrl targets the local BFF in root deployments", () => {
  assert.equal(
    buildDisclosureDocumentUrl("20260430000123", ""),
    "/api/trading/disclosures/dart/filings/document?rcept_no=20260430000123",
  );
});

test("buildDisclosureDocumentUrl prefixes the deployment base path and encodes receipt numbers", () => {
  assert.equal(
    buildDisclosureDocumentUrl("2026 04/30", "/trading-web/"),
    "/trading-web/api/trading/disclosures/dart/filings/document?rcept_no=2026+04%2F30",
  );
});

test("buildDisclosureDocumentUrl reads NEXT_PUBLIC_BASE_PATH by default", (t) => {
  const originalBasePath = process.env.NEXT_PUBLIC_BASE_PATH;
  t.after(() => {
    if (originalBasePath === undefined) {
      delete process.env.NEXT_PUBLIC_BASE_PATH;
    } else {
      process.env.NEXT_PUBLIC_BASE_PATH = originalBasePath;
    }
  });

  process.env.NEXT_PUBLIC_BASE_PATH = "/trading-web";

  assert.equal(
    buildDisclosureDocumentUrl("20260430000123"),
    "/trading-web/api/trading/disclosures/dart/filings/document?rcept_no=20260430000123",
  );
});
