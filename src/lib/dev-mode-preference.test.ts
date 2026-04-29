import assert from "node:assert/strict";
import test from "node:test";

import {
  DEV_MODE_PREFERENCE_KEY,
  LEGACY_DEV_MODE_KEY,
  readDevModePreference,
  storeDevModePreference,
} from "./dev-mode-preference";

function installLocalStorage(initialValues: Record<string, string> = {}) {
  const originalWindowDescriptor = Object.getOwnPropertyDescriptor(globalThis, "window");
  const values = new Map(Object.entries(initialValues));
  const storage = {
    getItem: (key: string) => values.get(key) ?? null,
    removeItem: (key: string) => {
      values.delete(key);
    },
    setItem: (key: string, value: string) => {
      values.set(key, value);
    },
  };

  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: { localStorage: storage },
  });

  return {
    restore: () => {
      if (originalWindowDescriptor) {
        Object.defineProperty(globalThis, "window", originalWindowDescriptor);
      } else {
        delete (globalThis as { window?: unknown }).window;
      }
    },
    values,
  };
}

test("readDevModePreference defaults off when no explicit preference exists", () => {
  const { restore } = installLocalStorage();

  try {
    assert.equal(readDevModePreference(), false);
  } finally {
    restore();
  }
});

test("readDevModePreference ignores legacy boolean dev-mode storage", () => {
  const { restore } = installLocalStorage({
    [LEGACY_DEV_MODE_KEY]: "true",
  });

  try {
    assert.equal(readDevModePreference(), false);
  } finally {
    restore();
  }
});

test("readDevModePreference restores a current explicit user-toggle preference", () => {
  const { restore } = installLocalStorage({
    [DEV_MODE_PREFERENCE_KEY]: JSON.stringify({ enabled: true, source: "user-toggle", version: 1 }),
  });

  try {
    assert.equal(readDevModePreference(), true);
  } finally {
    restore();
  }
});

test("storeDevModePreference writes the current preference and removes legacy storage", () => {
  const { restore, values } = installLocalStorage({
    [LEGACY_DEV_MODE_KEY]: "true",
  });

  try {
    storeDevModePreference(true);

    assert.equal(values.has(LEGACY_DEV_MODE_KEY), false);
    assert.deepEqual(JSON.parse(values.get(DEV_MODE_PREFERENCE_KEY) ?? "{}"), {
      enabled: true,
      source: "user-toggle",
      version: 1,
    });
  } finally {
    restore();
  }
});
