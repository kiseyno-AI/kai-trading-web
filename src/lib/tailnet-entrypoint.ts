export const DEFAULT_TAILNET_HOST = "gangseunghyeon-uiui-macmini-1.tail1d831c.ts.net";
export const DEFAULT_TAILNET_BASE_PATH = "/trading-web";
export const DEFAULT_TAILNET_BROWSER_ENTRYPOINT_URL = `https://${DEFAULT_TAILNET_HOST}${DEFAULT_TAILNET_BASE_PATH}`;

type TailnetEntrypointEnv = Record<string, string | undefined>;

export type TailnetBrowserNavigationEntrypoint = {
  sourceName: "TAILNET_BROWSER_ENTRYPOINT_URL" | "TAILNET_ENTRYPOINT_URL" | null;
  configuredUrl: string;
  navigationUrl: string;
  recoveredFromLegacyHttp: boolean;
};

export function normalizeTailnetBrowserEntrypointUrl(entrypointUrl: string) {
  const trimmedUrl = entrypointUrl.trim();

  if (!trimmedUrl) {
    return "";
  }

  try {
    const url = new URL(trimmedUrl);

    if (url.protocol === "http:" && url.hostname.endsWith(".ts.net")) {
      url.protocol = "https:";
    }

    return url.toString();
  } catch {
    return trimmedUrl;
  }
}

export function resolveTailnetBrowserNavigationEntrypoint(
  env: TailnetEntrypointEnv,
): TailnetBrowserNavigationEntrypoint {
  const browserEntrypointUrl = env.TAILNET_BROWSER_ENTRYPOINT_URL?.trim() ?? "";
  const tailnetEntrypointUrl = env.TAILNET_ENTRYPOINT_URL?.trim() ?? "";
  const configuredUrl = browserEntrypointUrl || tailnetEntrypointUrl;
  const sourceName = browserEntrypointUrl
    ? "TAILNET_BROWSER_ENTRYPOINT_URL"
    : tailnetEntrypointUrl
      ? "TAILNET_ENTRYPOINT_URL"
      : null;
  const navigationUrl = normalizeTailnetBrowserEntrypointUrl(configuredUrl);

  return {
    sourceName,
    configuredUrl,
    navigationUrl,
    recoveredFromLegacyHttp: configuredUrl !== navigationUrl && isLegacyHttpTailnetEntrypointUrl(configuredUrl),
  };
}

export function formatTailnetBrowserNavigationEntrypoint(entrypoint: TailnetBrowserNavigationEntrypoint) {
  if (!entrypoint.configuredUrl) {
    return "Tailnet browser navigation entrypoint is not configured";
  }

  const source = entrypoint.sourceName ?? "unknown";

  if (entrypoint.recoveredFromLegacyHttp) {
    return `Recovered Tailnet browser navigation entrypoint: ${source}=${entrypoint.configuredUrl} -> ${entrypoint.navigationUrl}`;
  }

  return `Tailnet browser navigation entrypoint: ${source}=${entrypoint.navigationUrl}`;
}

function isLegacyHttpTailnetEntrypointUrl(entrypointUrl: string) {
  try {
    const url = new URL(entrypointUrl.trim());

    return url.protocol === "http:" && url.hostname.endsWith(".ts.net");
  } catch {
    return false;
  }
}
