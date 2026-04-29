"use client";

export const DEV_MODE_PREFERENCE_KEY = "trading-web.dev-mode.preference";
export const LEGACY_DEV_MODE_KEY = "trading-web.dev-mode";
const DEV_MODE_PREFERENCE_VERSION = 1;
const DEV_MODE_PREFERENCE_SOURCE = "user-toggle";

type DevModePreferenceRecord = {
  enabled: boolean;
  source: typeof DEV_MODE_PREFERENCE_SOURCE;
  version: typeof DEV_MODE_PREFERENCE_VERSION;
};

function getStorage() {
  if (typeof window === "undefined") return null;

  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function isDevModePreferenceRecord(value: unknown): value is DevModePreferenceRecord {
  if (typeof value !== "object" || value === null) return false;

  const candidate = value as Partial<DevModePreferenceRecord>;
  return (
    typeof candidate.enabled === "boolean" &&
    candidate.source === DEV_MODE_PREFERENCE_SOURCE &&
    candidate.version === DEV_MODE_PREFERENCE_VERSION
  );
}

export function readDevModePreference(fallback = false) {
  const storage = getStorage();
  if (!storage) return fallback;

  const raw = storage.getItem(DEV_MODE_PREFERENCE_KEY);
  if (!raw) return fallback;

  try {
    const parsed: unknown = JSON.parse(raw);
    return isDevModePreferenceRecord(parsed) ? parsed.enabled : fallback;
  } catch {
    return fallback;
  }
}

export function storeDevModePreference(enabled: boolean) {
  const storage = getStorage();
  if (!storage) return;

  const record: DevModePreferenceRecord = {
    enabled,
    source: DEV_MODE_PREFERENCE_SOURCE,
    version: DEV_MODE_PREFERENCE_VERSION,
  };

  storage.setItem(DEV_MODE_PREFERENCE_KEY, JSON.stringify(record));
  storage.removeItem(LEGACY_DEV_MODE_KEY);
}
