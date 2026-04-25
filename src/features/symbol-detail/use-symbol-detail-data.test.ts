import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import ts from "typescript";

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
