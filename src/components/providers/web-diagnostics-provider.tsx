"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { usePathname } from "next/navigation";

import {
  isWebDiagnosticsEnabled,
  logWebDiagnostic,
  sanitizeDiagnosticUrl,
} from "@/lib/web-diagnostics";

const INTERACTIVE_SELECTOR = "a, button, summary, [role='button'], [data-diagnostic-click]";

function normalizeText(value: string | null | undefined) {
  return value?.replace(/\s+/g, " ").trim() || null;
}

function getCurrentScreenPath() {
  if (typeof window === "undefined") return "";
  return `${window.location.pathname}${window.location.search}${window.location.hash}`;
}

function getElementLabel(element: Element) {
  return (
    normalizeText(element.getAttribute("data-diagnostic-label")) ??
    normalizeText(element.getAttribute("aria-label")) ??
    normalizeText(element.getAttribute("title")) ??
    normalizeText(element.textContent) ??
    element.tagName.toLowerCase()
  );
}

function getElementHref(element: Element) {
  const href = element.getAttribute("href");
  return href ? sanitizeDiagnosticUrl(href) : null;
}

function describeElement(element: Element) {
  return {
    currentScreen: getCurrentScreenPath(),
    diagnosticId: element.getAttribute("data-diagnostic-id"),
    href: getElementHref(element),
    id: element.id || null,
    label: getElementLabel(element),
    pressed: element.getAttribute("aria-pressed"),
    role: element.getAttribute("role"),
    tagName: element.tagName.toLowerCase(),
    type: element.getAttribute("type"),
  };
}

function describeField(element: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement) {
  const fieldLabel =
    normalizeText(element.getAttribute("data-diagnostic-label")) ??
    normalizeText(element.getAttribute("aria-label")) ??
    normalizeText(element.getAttribute("placeholder")) ??
    normalizeText(element.labels?.[0]?.textContent) ??
    element.name ??
    element.id ??
    element.tagName.toLowerCase();
  const fieldType = element instanceof HTMLInputElement ? element.type : element.tagName.toLowerCase();

  return {
    checked: element instanceof HTMLInputElement && ["checkbox", "radio"].includes(element.type)
      ? element.checked
      : undefined,
    currentScreen: getCurrentScreenPath(),
    id: element.id || null,
    label: fieldLabel,
    name: element.name || null,
    tagName: element.tagName.toLowerCase(),
    type: fieldType,
    valueLength: fieldType === "password" ? undefined : element.value.length,
  };
}

export function WebDiagnosticsProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const previousScreenRef = useRef<string | null>(null);

  useEffect(() => {
    if (!isWebDiagnosticsEnabled()) return;

    const nextScreen = getCurrentScreenPath();
    const previousScreen = previousScreenRef.current;
    if (nextScreen === previousScreen) return;

    logWebDiagnostic("navigation", previousScreen ? "screen-transition" : "screen-enter", {
      from: previousScreen,
      title: document.title,
      to: nextScreen,
    });
    previousScreenRef.current = nextScreen;
  }, [pathname]);

  useEffect(() => {
    if (!isWebDiagnosticsEnabled()) return;

    const logCurrentScreen = () => {
      const nextScreen = getCurrentScreenPath();
      const previousScreen = previousScreenRef.current;
      if (nextScreen === previousScreen) return;

      logWebDiagnostic("navigation", previousScreen ? "screen-transition" : "screen-enter", {
        from: previousScreen,
        title: document.title,
        to: nextScreen,
      });
      previousScreenRef.current = nextScreen;
    };

    const onClick = (event: MouseEvent) => {
      if (!(event.target instanceof Element)) return;

      const interactiveElement = event.target.closest(INTERACTIVE_SELECTOR);
      if (!interactiveElement) return;

      logWebDiagnostic(
        "interaction",
        interactiveElement.tagName.toLowerCase() === "a" ? "link-click" : "button-click",
        describeElement(interactiveElement),
      );
    };

    const onSubmit = (event: SubmitEvent) => {
      if (!(event.target instanceof HTMLFormElement)) return;

      logWebDiagnostic("interaction", "form-submit", {
        currentScreen: getCurrentScreenPath(),
        formAction: sanitizeDiagnosticUrl(event.target.action),
        id: event.target.id || null,
        label: getElementLabel(event.target),
        method: event.target.method,
      });
    };

    const onChange = (event: Event) => {
      if (
        event.target instanceof HTMLInputElement ||
        event.target instanceof HTMLSelectElement ||
        event.target instanceof HTMLTextAreaElement
      ) {
        logWebDiagnostic("interaction", "field-change", describeField(event.target));
      }
    };

    document.addEventListener("click", onClick, true);
    document.addEventListener("submit", onSubmit, true);
    document.addEventListener("change", onChange, true);
    window.addEventListener("hashchange", logCurrentScreen);
    window.addEventListener("popstate", logCurrentScreen);

    return () => {
      document.removeEventListener("click", onClick, true);
      document.removeEventListener("submit", onSubmit, true);
      document.removeEventListener("change", onChange, true);
      window.removeEventListener("hashchange", logCurrentScreen);
      window.removeEventListener("popstate", logCurrentScreen);
    };
  }, []);

  return children;
}
