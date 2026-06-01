export const DEFAULT_TAILNET_HOST = "gangseunghyeon-uiui-macmini-1.tail1d831c.ts.net";
export const DEFAULT_TAILNET_BASE_PATH = "/trading-web";
export const DEFAULT_TAILNET_BROWSER_ENTRYPOINT_URL = `https://${DEFAULT_TAILNET_HOST}${DEFAULT_TAILNET_BASE_PATH}`;

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
