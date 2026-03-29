"use client";

export function readStoredValue<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;

  const raw = window.localStorage.getItem(key);
  if (!raw) return fallback;

  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function storeValue<T>(key: string, value: T) {
  if (typeof window === "undefined") return;

  window.localStorage.setItem(key, JSON.stringify(value));
}

export function writeCookie(name: string, value: string, days = 365) {
  if (typeof document === "undefined") return;

  const maxAge = days * 24 * 60 * 60;
  document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=${maxAge}; SameSite=Lax`;
}
