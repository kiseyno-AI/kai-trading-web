import assert from "node:assert/strict";
import test from "node:test";

import {
  hasCompletedFilteringReload,
  INITIAL_FILTERING_RELOAD_KEY,
  isFilteringBackgroundReload,
} from "./filtering-fallback-revalidation";

test("treats only repeated reloads for the same market date as background filtering reloads", () => {
  assert.equal(
    isFilteringBackgroundReload({
      currentMarketDate: "2026-04-27",
      previousReloadKey: {
        marketDate: "2026-04-27",
        reloadCount: 0,
      },
      reloadCount: 1,
    }),
    true,
  );
  assert.equal(
    isFilteringBackgroundReload({
      currentMarketDate: "2026-04-28",
      previousReloadKey: {
        marketDate: "2026-04-27",
        reloadCount: 1,
      },
      reloadCount: 1,
    }),
    false,
  );
});

test("completion-gates slow fallback reload scheduling until the in-flight reload settles", () => {
  assert.equal(
    hasCompletedFilteringReload({
      completionKey: INITIAL_FILTERING_RELOAD_KEY,
      currentMarketDate: "2026-04-27",
      reloadCount: 0,
    }),
    false,
  );
  assert.equal(
    hasCompletedFilteringReload({
      completionKey: {
        marketDate: "2026-04-27",
        reloadCount: 0,
      },
      currentMarketDate: "2026-04-27",
      reloadCount: 1,
    }),
    false,
  );
  assert.equal(
    hasCompletedFilteringReload({
      completionKey: {
        marketDate: "2026-04-27",
        reloadCount: 1,
      },
      currentMarketDate: "2026-04-27",
      reloadCount: 1,
    }),
    true,
  );
});

test("does not treat a previous market date completion as permission to schedule the next fallback reload", () => {
  assert.equal(
    hasCompletedFilteringReload({
      completionKey: {
        marketDate: "2026-04-24",
        reloadCount: 3,
      },
      currentMarketDate: "2026-04-27",
      reloadCount: 3,
    }),
    false,
  );
});
