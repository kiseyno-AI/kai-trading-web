import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import ts from "typescript";

import { findExactSymbolItem } from "./use-symbol-detail-data";

test("keeps symbol-scoped selections unavailable when only another symbol is returned", () => {
  const upstreamRows: Array<{
    selector: string;
    rows: Array<{ symbol: string } & Record<string, unknown>>;
  }> = [
    { selector: "metadata", rows: [{ symbol: "000660", name: "SK hynix" }] },
    { selector: "aggregate", rows: [{ symbol: "000660", fundamentals: {} }] },
    { selector: "action", rows: [{ symbol: "000660", action: "buy" }] },
    { selector: "technical", rows: [{ symbol: "000660", signal: "bullish" }] },
  ];

  for (const { selector, rows } of upstreamRows) {
    assert.equal(
      findExactSymbolItem(rows, "005930"),
      null,
      `${selector} must not substitute the first upstream row for 005930`,
    );
  }
});

test("wires metadata, aggregate, action, and technical fetches through exact-symbol selection", () => {
  const useDataSource = readFileSync(new URL("./use-symbol-detail-data.ts", import.meta.url), "utf8");
  const sectionSource = readFileSync(new URL("./symbol-detail-sections.tsx", import.meta.url), "utf8");

  assert.match(useDataSource, /findExactSymbolItem\(data\.items, normalizedSymbol\)/);
  assert.equal(
    sectionSource.match(/findExactSymbolItem\(data\.items, normalizedSymbol\)/g)?.length,
    2,
    "expected action and technical fetchers to use the exact-symbol selector",
  );
  assert.match(
    sectionSource,
    /findExactSymbolItem\(aggregateResponse\.items, normalizedSymbol\)/,
    "expected the aggregate symbol-day fetcher to use the exact-symbol selector",
  );
});

test("guards the symbol-detail quote response with exact normalized symbol selection", () => {
  const source = readFileSync(new URL("./use-symbol-detail-data.ts", import.meta.url), "utf8");

  assert.match(
    source,
    /selectExactSymbolQuote\(\s*await fetchUnitJson<QuoteResponse>/,
    "the symbol-detail quote fetcher must reject another symbol's response",
  );
});

test("reloads tracked symbol membership when normalizedSymbol changes", () => {
  const sourcePath = new URL("./use-symbol-detail-data.ts", import.meta.url);
  const source = readFileSync(sourcePath, "utf8");
  const sourceFile = ts.createSourceFile(
    sourcePath.pathname,
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );

  let dependencyNames: string[] | null = null;

  const visit = (node: ts.Node) => {
    if (
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === "useEffect"
    ) {
      const [callback, dependencies] = node.arguments;
      if (
        callback &&
        dependencies &&
        ts.isArrayLiteralExpression(dependencies) &&
        callback.getText(sourceFile).includes("loadTrackedSymbolsSnapshot(copy)")
      ) {
        dependencyNames = dependencies.elements
          .map((element) => element.getText(sourceFile))
          .filter(Boolean);
      }
    }

    ts.forEachChild(node, visit);
  };

  visit(sourceFile);

  assert.ok(dependencyNames, "expected tracked-symbol snapshot effect dependencies");
  assert.deepEqual(dependencyNames, ["copy", "normalizedSymbol", "symbolReady"]);
});
