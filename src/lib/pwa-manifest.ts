import type { MetadataRoute } from "next";

export function normalizeManifestBasePath(basePath = process.env.NEXT_PUBLIC_BASE_PATH): string {
  const trimmedBasePath = basePath?.trim() ?? "";

  if (!trimmedBasePath || trimmedBasePath === "/") {
    return "";
  }

  const basePathWithLeadingSlash = trimmedBasePath.startsWith("/")
    ? trimmedBasePath
    : `/${trimmedBasePath}`;
  return basePathWithLeadingSlash.replace(/\/+$/, "");
}

export function buildPwaManifest(basePath = normalizeManifestBasePath()): MetadataRoute.Manifest {
  const pathWithBasePath = (pathname: `/${string}`) => `${basePath}${pathname}`;

  return {
    name: "KAI Trading Dashboard",
    short_name: "KAI Trading",
    description: "Market dashboard for symbols, watchlists, and trading system health.",
    start_url: pathWithBasePath("/dashboard"),
    display: "standalone",
    background_color: "#07182d",
    theme_color: "#13283f",
    icons: [
      {
        src: pathWithBasePath("/app-icon-192.png"),
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: pathWithBasePath("/app-icon-512.png"),
        sizes: "512x512",
        type: "image/png",
      },
      {
        src: pathWithBasePath("/app-icon-512.png"),
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
